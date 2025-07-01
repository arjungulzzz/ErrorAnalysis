import { type LogsApiRequest, type LogsApiResponse, type ErrorLog, type ApiErrorLog, type GroupDataPoint, type ErrorTrendDataPoint, GroupByOption } from '@/types';
import { generateMockLogs } from './mock-data';
import { format, startOfDay, endOfDay, eachDayOfInterval, parseISO } from 'date-fns';

// Generate a large set of logs once to be used by all mock requests
const allMockLogs = generateMockLogs(5000);

function applyFiltering(logs: ErrorLog[], filters: LogsApiRequest['filters']): ErrorLog[] {
    let filteredLogs = logs;
    Object.entries(filters).forEach(([key, value]) => {
        if (value) {
            const filterKey = key as keyof ErrorLog;
            filteredLogs = filteredLogs.filter(log => {
                const logValue = log[filterKey];
                if (logValue === null || logValue === undefined) return false;
                
                if (typeof logValue === 'string') {
                    return logValue.toLowerCase().includes(String(value).toLowerCase());
                }
                if (typeof logValue === 'number') {
                    return String(logValue).toLowerCase().includes(String(value).toLowerCase());
                }
                // for Date objects, which we shouldn't be filtering by string anyway
                return false;
            });
        }
    });
    return filteredLogs;
}

function applySorting(logs: ErrorLog[], sort: LogsApiRequest['sort']): ErrorLog[] {
    const { column, direction } = sort;
    if (!column || !direction) {
        // Default sort if none provided in request, matching frontend default
        return [...logs].sort((a, b) => b.log_date_time.getTime() - a.log_date_time.getTime());
    }
    const sortedLogs = [...logs].sort((a, b) => {
        const aVal = a[column];
        const bVal = b[column];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (aVal < bVal) return direction === 'ascending' ? -1 : 1;
        if (aVal > bVal) return direction === 'ascending' ? 1 : -1;
        return 0;
    });
    return sortedLogs;
}

function generateGroupData(logs: ErrorLog[], groupBy: LogsApiRequest['groupBy']): GroupDataPoint[] {
    if (groupBy.length === 0) {
        return [];
    }
    
    const recursiveGroup = (data: ErrorLog[], groupByKeys: GroupByOption[]): GroupDataPoint[] => {
        if (groupByKeys.length === 0) {
            return [];
        }

        const [currentKey, ...restKeys] = groupByKeys;
        
        const grouped = data.reduce((acc, log) => {
            const key = String(log[currentKey as keyof ErrorLog] ?? 'N/A');
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(log);
            return acc;
        }, {} as Record<string, ErrorLog[]>);

        return Object.entries(grouped).map(([key, items]) => ({
            key,
            count: items.length,
            subgroups: recursiveGroup(items, restKeys),
        }));
    };

    return recursiveGroup(logs, groupBy);
}

function generateChartData(logs: ErrorLog[], request: LogsApiRequest): ErrorTrendDataPoint[] {
    if (!request.dateRange?.from) {
        return [];
    }
    let startDate: Date = request.dateRange.from;
    let endDate: Date = request.dateRange.to || new Date();
    
    // Simplified bucketing logic: just group by day for this mock
    const daysInInterval = eachDayOfInterval({ start: startOfDay(startDate), end: endOfDay(endDate) });

    const chartData = daysInInterval.map(day => {
        const logsOnDay = logs.filter(log => startOfDay(log.log_date_time).getTime() === day.getTime());

        const breakdown = logsOnDay.reduce((acc, log) => {
            const key = String(log[request.chartBreakdownBy] ?? 'N/A');
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            date: day.toISOString(),
            count: logsOnDay.length,
            formattedDate: format(day, 'MMM dd'),
            breakdown: breakdown,
        };
    });

    return chartData;
}


export function processMockRequest(request: LogsApiRequest): LogsApiResponse {
    let logs = [...allMockLogs];
    
    // 1. Filter by date range. This is the single source of truth for time filtering.
    if (request.dateRange?.from) {
        const fromDate = request.dateRange.from;
        const toDate = request.dateRange.to || new Date();

        logs = logs.filter(log => {
            const logTime = log.log_date_time.getTime();
            // Use endOfDay for `toDate` to include all logs on the last day, which is crucial for calendar selections.
            return logTime >= fromDate.getTime() && logTime <= endOfDay(toDate).getTime();
        });
    }
    
    // 2. Apply column filters
    logs = applyFiltering(logs, request.filters);
    
    // 3. Get aggregates before sorting/pagination for logs
    const totalCount = logs.length;
    const groupData = generateGroupData(logs, request.groupBy);
    const chartData = generateChartData(logs, request);
    
    // 4. Sort
    logs = applySorting(logs, request.sort);
    
    // 5. Paginate
    const { page, pageSize } = request.pagination;
    const paginatedLogs = logs.slice((page - 1) * pageSize, page * pageSize);
    
    const apiLogs: ApiErrorLog[] = paginatedLogs.map(log => {
        const { id, ...rest } = log;
        return {
            ...rest,
            log_date_time: log.log_date_time.toISOString(),
            as_start_date_time: log.as_start_date_time.toISOString(),
        }
    });

    return {
        logs: apiLogs,
        totalCount,
        groupData,
        chartData,
    };
}
