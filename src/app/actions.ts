"use server";

import { MOCK_LOGS } from "@/lib/mock-data";
import { type ErrorLog, type ErrorTrendDataPoint } from "@/types";
import { format } from "date-fns";

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
    filteredLogs = filteredLogs.filter(log => new Date(log.log_date_time) <= toDate);
  }
  
  // Return all logs matching the date range. Sorting and pagination will be done on the client.
  return filteredLogs;
}

export async function getErrorCountsByDate({
  dateRange,
}: {
  dateRange?: { from?: Date; to?: Date };
}): Promise<ErrorTrendDataPoint[]> {
  await new Promise(resolve => setTimeout(resolve, 300));

  const filteredLogs = MOCK_LOGS;

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
