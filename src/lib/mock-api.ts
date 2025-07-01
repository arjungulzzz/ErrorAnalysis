/**
 * @fileoverview
 * A mock API service that simulates a real backend for the Error Insights Dashboard.
 * It generates a large dataset of logs and provides functions to filter, sort,
 * paginate, and group the data, mimicking the behavior of a real API endpoint.
 */

import {
  type ErrorLog,
  type LogsApiRequest,
  type LogsApiResponse,
  type GroupByOption,
  type GroupDataPoint,
  type ErrorTrendDataPoint,
  type ChartBreakdownByOption,
} from '@/types';
import { generateMockLogs } from './mock-data';

// Generate a large set of logs on initialization to simulate a database.
const MOCK_LOGS: ErrorLog[] = generateMockLogs(5000);

/**
 * Main function to process a logs request and return a simulated API response.
 * This function orchestrates filtering, sorting, and data aggregation.
 * @param request The request object from the frontend.
 * @returns A structured API response.
 */
export function processLogsRequest(request: LogsApiRequest): LogsApiResponse {
  let filteredLogs = [...MOCK_LOGS];

  // 1. Apply column filters
  if (request.filters) {
    Object.entries(request.filters).forEach(([key, value]) => {
      if (value) {
        filteredLogs = filteredLogs.filter((log) => {
          const logValue = log[key as keyof ErrorLog];
          if (logValue === null || logValue === undefined) return false;
          return String(logValue).toLowerCase().includes(String(value).toLowerCase());
        });
      }
    });
  }

  // 2. Apply sorting
  if (request.sort && request.sort.column && request.sort.direction) {
    const { column, direction } = request.sort;
    filteredLogs.sort((a, b) => {
      const valA = a[column];
      const valB = b[column];

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      
      let comparison = 0;
      if (valA > valB) {
        comparison = 1;
      } else if (valA < valB) {
        comparison = -1;
      }
      return direction === 'descending' ? comparison * -1 : comparison;
    });
  }

  const totalCount = filteredLogs.length;

  // 3. Generate chart data (must be done *before* grouping and pagination)
  const chartData = generateChartData(filteredLogs, request.chartBreakdownBy);

  // 4. Handle grouping
  let groupData: GroupDataPoint[] = [];
  let paginatedLogs: ErrorLog[] = [];

  if (request.groupBy && request.groupBy.length > 0) {
    groupData = generateGroupData(filteredLogs, request.groupBy);
    // When grouping, the main log view is empty as the table will render groups instead.
    paginatedLogs = [];
  } else {
    // 5. Apply pagination if not grouping
    const { page, pageSize } = request.pagination;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    paginatedLogs = filteredLogs.slice(start, end);
  }

  // The API is expected to return date strings, not Date objects.
  const apiLogs = paginatedLogs.map(log => ({
    ...log,
    log_date_time: log.log_date_time.toISOString(),
    as_start_date_time: log.as_start_date_time.toISOString(),
  }));

  return {
    logs: apiLogs,
    totalCount,
    chartData,
    groupData,
  };
}

/**
 * Helper to generate nested group data for the table.
 * @param logs The logs to group.
 * @param groupBy An array of column keys to group by.
 * @returns A nested array of group data points.
 */
function generateGroupData(logs: ErrorLog[], groupBy: GroupByOption[]): GroupDataPoint[] {
  if (groupBy.length === 0) return [];

  const recursiveGroup = (
    currentLogs: ErrorLog[],
    groupingLevels: GroupByOption[]
  ): GroupDataPoint[] => {
    if (groupingLevels.length === 0) return [];

    const currentLevelKey = groupingLevels[0];
    const remainingLevels = groupingLevels.slice(1);

    const groupedMap = new Map<string, ErrorLog[]>();

    for (const log of currentLogs) {
      const key = String(log[currentLevelKey] ?? 'N/A');
      if (!groupedMap.has(key)) {
        groupedMap.set(key, []);
      }
      groupedMap.get(key)!.push(log);
    }

    const result: GroupDataPoint[] = [];
    for (const [key, groupLogs] of groupedMap.entries()) {
      result.push({
        key,
        count: groupLogs.length,
        subgroups: recursiveGroup(groupLogs, remainingLevels),
      });
    }

    return result.sort((a, b) => b.count - a.count); // Sort groups by count descending
  };

  return recursiveGroup(logs, groupBy);
}

/**
 * Helper to generate time-series data for the trend chart.
 * @param logs The logs to analyze.
 * @param breakdownBy The column to use for the tooltip breakdown.
 * @returns An array of data points for the chart.
 */
function generateChartData(
  logs: ErrorLog[],
  breakdownBy: ChartBreakdownByOption
): ErrorTrendDataPoint[] {
  if (logs.length === 0) return [];

  const sortedLogs = [...logs].sort((a, b) => a.log_date_time.getTime() - b.log_date_time.getTime());
  const minDate = sortedLogs[0].log_date_time;
  const maxDate = sortedLogs[sortedLogs.length - 1].log_date_time;
  const rangeHours = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60);

  let bucketSize: 'day' | 'hour' | '30minute' = 'day';
  if (rangeHours <= 72) { // 3 days
    bucketSize = 'hour';
  }
  if (rangeHours <= 12) { // 12 hours
    bucketSize = '30minute';
  }

  const getBucketKey = (date: Date): string => {
    const d = new Date(date);
    d.setSeconds(0, 0);
    if (bucketSize === 'day') {
      d.setHours(0, 0, 0, 0);
    } else if (bucketSize === 'hour') {
      d.setMinutes(0);
    } else if (bucketSize === '30minute') {
      const minutes = d.getMinutes();
      d.setMinutes(minutes < 30 ? 0 : 30);
    }
    return d.toISOString();
  };

  const trendMap = new Map<string, { count: number; breakdown: Record<string, number> }>();

  for (const log of logs) {
    const bucketKey = getBucketKey(log.log_date_time);
    if (!trendMap.has(bucketKey)) {
      trendMap.set(bucketKey, { count: 0, breakdown: {} });
    }

    const entry = trendMap.get(bucketKey)!;
    entry.count += 1;

    const breakdownKey = String(log[breakdownBy] ?? 'N/A');
    entry.breakdown[breakdownKey] = (entry.breakdown[breakdownKey] || 0) + 1;
  }
  
  const chartData: ErrorTrendDataPoint[] = [];
  for (const [date, data] of trendMap.entries()) {
    const d = new Date(date);
    let formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (bucketSize === 'hour' || bucketSize === '30minute') {
      formattedDate = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
    }

    chartData.push({
      date,
      count: data.count,
      formattedDate,
      breakdown: data.breakdown,
    });
  }

  return chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
