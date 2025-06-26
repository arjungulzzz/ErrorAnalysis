"use server";

import { MOCK_LOGS } from "@/lib/mock-data";
import { type ErrorLog } from "@/types";

export async function getErrorLogs(
  {
    dateRange,
  }: {
    dateRange?: { from?: Date; to?: Date };
  }
): Promise<ErrorLog[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  let filteredLogs = MOCK_LOGS;

  // Filter by date range
  if (dateRange?.from) {
    filteredLogs = filteredLogs.filter(log => new Date(log.log_date_time) >= new Date(dateRange.from!));
  }
  if (dateRange?.to) {
    const toDate = new Date(dateRange.to);
    toDate.setHours(23, 59, 59, 999); // Include all logs on the end date
    filteredLogs = filteredLogs.filter(log => new Date(log.log_date_time) <= toDate);
  }
  
  // Return all logs matching the date range. Sorting and pagination will be done on the client.
  return filteredLogs;
}
