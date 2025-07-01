/**
 * @fileoverview
 * A component that visualizes the frequency of errors over a period of time.
 * It uses an area chart to plot the total number of errors per day and includes
 * a detailed tooltip showing a breakdown of errors by host for each data point.
 */
"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Skeleton } from "./ui/skeleton";
import { type ErrorTrendDataPoint, type ChartBreakdownByOption } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface ErrorTrendChartProps {
  data: ErrorTrendDataPoint[];
  isLoading: boolean;
  breakdownBy: ChartBreakdownByOption;
  setBreakdownBy: (value: ChartBreakdownByOption) => void;
}

const chartConfig = {
  errors: {
    label: "Errors",
    color: "hsl(var(--destructive))",
  },
}

const breakdownOptions: { value: ChartBreakdownByOption; label: string }[] = [
  { value: 'host_name', label: 'Host' },
  { value: 'repository_path', label: 'Model Name' },
  { value: 'port_number', label: 'Port' },
  { value: 'version_number', label: 'AS Version' },
  { value: 'as_server_mode', label: 'Server Mode' },
  { value: 'as_server_config', label: 'Server Config' },
  { value: 'user_id', label: 'User' },
  { value: 'report_id_name', label: 'Report Name' },
  { value: 'error_number', label: 'Error Code' },
  { value: 'xql_query_id', label: 'Query ID' },
];

const CustomTooltip = ({ active, payload, breakdownBy }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ErrorTrendDataPoint;

    const isTimeBased = data.formattedDate.includes(":");
    const fullDate = isTimeBased
      ? new Date(data.date).toLocaleString('en-US', {
          timeZone: 'UTC',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : new Date(data.date).toLocaleDateString('en-US', {
          timeZone: 'UTC',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

    const breakdownTitle = breakdownOptions.find(o => o.value === breakdownBy)?.label || 'Breakdown';
    const breakdownEntries = Object.entries(data.breakdown).sort(([, a], [, b]) => b - a);

    return (
      <div className="min-w-[12rem] rounded-lg border bg-background p-2 text-xs shadow-lg">
        <div className="mb-2">
          <p className="font-bold text-sm">{fullDate}</p>
          <p className="text-muted-foreground">{`Total Errors: ${data.count}`}</p>
        </div>
        {breakdownEntries.length > 0 && (
          <div className="pt-2 border-t">
            <p className="font-semibold mb-1">By {breakdownTitle}</p>
            <div className="space-y-1">
              {breakdownEntries.slice(0, 5).map(([key, count]) => (
                <div key={key} className="flex justify-between items-center text-muted-foreground">
                  <span className="truncate" title={key}>{key}</span>
                  <span className="font-medium text-foreground ml-2">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};


export function ErrorTrendChart({ data, isLoading, breakdownBy, setBreakdownBy }: ErrorTrendChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (!data || data.length === 0) {
    return (
       <Card>
        <CardHeader>
          <CardTitle>Error Trend</CardTitle>
          <CardDescription>
            The frequency of errors over the selected time period.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
                No data available for the selected period.
            </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
            <CardTitle>Error Trend</CardTitle>
            <CardDescription>
            The frequency of errors over the selected time period.
            </CardDescription>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Breakdown By</span>
            <Select value={breakdownBy} onValueChange={(value) => setBreakdownBy(value as ChartBreakdownByOption)} disabled={isLoading}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Breakdown by..." />
                </SelectTrigger>
                <SelectContent>
                    {breakdownOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{
              top: 5,
              right: 20,
              left: 10,
              bottom: 5,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="formattedDate"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              allowDecimals={false}
            />
            <ChartTooltip
              cursor={false}
              content={<CustomTooltip breakdownBy={breakdownBy} />}
            />
            <defs>
              <linearGradient id="fillErrors" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-errors)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-errors)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <Area
              dataKey="count"
              type="monotone"
              fill="url(#fillErrors)"
              fillOpacity={1}
              stroke="var(--color-errors)"
              strokeWidth={2}
              dot={true}
              name="errors"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
