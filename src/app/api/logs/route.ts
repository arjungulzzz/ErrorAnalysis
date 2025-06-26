import { NextResponse } from 'next/server';
import { getLogsByDateRange } from '@/services/logService';

export async function POST(request: Request) {
  try {
    const { dateRange }: { dateRange?: { from?: string; to?: string } } = await request.json();

    const logs = await getLogsByDateRange(dateRange);
    
    // Return all logs matching the date range.
    return NextResponse.json(logs);

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
