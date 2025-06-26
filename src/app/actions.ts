"use server";

import { MOCK_LOGS } from "@/lib/mock-data";
import { type ErrorLog, type SortDescriptor, type ColumnFilters, type SummarizeErrorsInput } from "@/types";
import { summarizeErrorGroup } from "@/ai/flows/summarize-errors-flow";

// This is a placeholder for a real AI-based anomaly detection service.
// For this demo, it identifies logs with messages that appear more than once in the paginated view.
async function detectAnomalies(logs: ErrorLog[]): Promise<string[]> {
  const messageCounts = new Map<string, number>();
  logs.forEach(log => {
    messageCounts.set(log.log_message, (messageCounts.get(log.log_message) || 0) + 1);
  });

  const anomalousMessages = new Set<string>();
  for (const [message, count] of messageCounts.entries()) {
    if (count > 1) { // Highlight if a message appears more than once in the current view
      anomalousMessages.add(message);
    }
  }

  const anomalousLogIds = logs
    .filter(log => anomalousMessages.has(log.log_message))
    .map(log => log.id);
  
  return anomalousLogIds;
}

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
): Promise<{ logs: ErrorLog[], total: number, anomalousLogIds: string[] }> {
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

  const anomalousLogIds = await detectAnomalies(paginatedLogs);

  return { logs: paginatedLogs, total, anomalousLogIds };
}

export async function getGroupSummary(logs: ErrorLog[]) {
  // To avoid sending too much data to the model, we only send a subset of fields and limit the number of logs.
  const preparedLogs: SummarizeErrorsInput = logs
    .slice(0, 20) // Limit to the most recent 20 logs in the group
    .map(log => ({
      error_number: log.error_number,
      log_message: log.log_message,
    }));
  
  return await summarizeErrorGroup(preparedLogs);
}
