"use server";

import { MOCK_LOGS } from "@/lib/mock-data";
import { type ErrorLog, type SortDescriptor, type ColumnFilters, type ErrorTrendDataPoint } from "@/types";
import { format } from "date-fns";

export async function getErrorLogs(
  {
    dateRange,
    columnFilters,
    page = 1,
    pageSize = 10,
    sort,
  }: {
    dateRange?: { from?: Date; to?: Date };
    columnFilters?: ColumnFilters,
    page?: number;
    pageSize?: number;
    sort?: SortDescriptor;
  }
): Promise<{ logs: ErrorLog[], total: number }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  let filteredLogs = MOCK_LOGS;

  // Filter by column filters
  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value) {
        filteredLogs = filteredLogs.filter(log => {
          const logValue = log[key as keyof ErrorLog];
          return String(logValue).toLowerCase().includes(value.toLowerCase());
        });
      }
    });
  }

  // Filter by date range
  if (dateRange?.from) {
    filteredLogs = filteredLogs.filter(log => new Date(log.log_date_time) >= new Date(dateRange.from!));
  }
  if (dateRange?.to) {
    const toDate = new Date(dateRange.to);
    filteredLogs = filteredLogs.filter(log => new Date(log.log_date_time) <= toDate);
  }

  // Sort data
  if (sort && sort.column && sort.direction) {
    filteredLogs.sort((a, b) => {
      const aValue = a[sort.column!];
      const bValue = b[sort.column!];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      let comparison = 0;
      if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      }


      return sort.direction === 'descending' ? comparison * -1 : comparison;
    });
  }

  const total = filteredLogs.length;
  
  const paginatedLogs = filteredLogs.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return { logs: paginatedLogs, total };
}

export async function getErrorCountsByDate({
  dateRange,
  columnFilters,
}: {
  dateRange?: { from?: Date; to?: Date };
  columnFilters?: ColumnFilters,
}): Promise<ErrorTrendDataPoint[]> {
  await new Promise(resolve => setTimeout(resolve, 300));

  let filteredLogs = MOCK_LOGS;

  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value) {
        filteredLogs = filteredLogs.filter(log => {
          const logValue = log[key as keyof ErrorLog];
          return String(logValue).toLowerCase().includes(value.toLowerCase());
        });
      }
    });
  }

  const countsByDate: Record<string, { count: number; breakdown: Record<string, number> }> = {};
  if(dateRange?.from && dateRange?.to){
    let current = new Date(dateRange.from);
    const to = new Date(dateRange.to);

    while (current <= to) {
        const dateStr = format(current, 'yyyy-MM-dd');
        countsByDate[dateStr] = { count: 0, breakdown: {} };
        current.setDate(current.getDate() + 1);
    }
  }

  let logsInDateRange = filteredLogs;
  if (dateRange?.from) {
    logsInDateRange = logsInDateRange.filter(log => new Date(log.log_date_time) >= new Date(dateRange.from!));
  }
  if (dateRange?.to) {
    const toDate = new Date(dateRange.to);
    logsInDateRange = logsInDateRange.filter(log => new Date(log.log_date_time) <= toDate);
  }

  logsInDateRange.forEach(log => {
    const dateStr = format(new Date(log.log_date_time), 'yyyy-MM-dd');
    if (dateRange) {
        if (countsByDate[dateStr] !== undefined) {
            countsByDate[dateStr].count++;
            const host = log.host_name;
            countsByDate[dateStr].breakdown[host] = (countsByDate[dateStr].breakdown[host] || 0) + 1;
        }
    } else {
        if (!countsByDate[dateStr]) {
            countsByDate[dateStr] = { count: 0, breakdown: {} };
        }
        countsByDate[dateStr].count++;
        const host = log.host_name;
        countsByDate[dateStr].breakdown[host] = (countsByDate[dateStr].breakdown[host] || 0) + 1;
    }
  });

  const chartData = Object.entries(countsByDate).map(([date, data]) => ({
    date,
    count: data.count,
    formattedDate: format(new Date(date), "MMM d"),
    breakdown: data.breakdown,
  }));

  chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return chartData;
}
