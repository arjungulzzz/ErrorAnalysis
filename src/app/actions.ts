"use server";

import { MOCK_LOGS } from "@/lib/mock-data";
import { type ErrorLog, type SortDescriptor, type ColumnFilters } from "@/types";

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
