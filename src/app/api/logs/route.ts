import { NextResponse } from 'next/server';
import { MOCK_LOGS } from "@/lib/mock-data";
import { type ErrorLog } from "@/types";

export async function POST(request: Request) {
  try {
    const { dateRange }: { dateRange?: { from?: string; to?: string } } = await request.json();

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    let filteredLogs: ErrorLog[] = MOCK_LOGS;

    // Filter by date range
    if (dateRange?.from) {
      const fromDate = new Date(dateRange.from);
      filteredLogs = filteredLogs.filter(log => new Date(log.log_date_time) >= fromDate);
    }
    if (dateRange?.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999); // Include all logs on the end date
      filteredLogs = filteredLogs.filter(log => new Date(log.log_date_time) <= toDate);
    }
    
    // Return all logs matching the date range.
    return NextResponse.json(filteredLogs);

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
