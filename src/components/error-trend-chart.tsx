/**
 * @fileoverview
 * A component that visualizes the frequency of errors over a period of time.
 * It uses an area chart to plot the total number of errors per day and includes
 * a detailed tooltip showing a breakdown of errors by host for each data point.
 */
"use client"

import * as React from "react"
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
  breakdownOptions: { value: ChartBreakdownByOption; label: string }[];
}

const chartConfig = {
  errors: {
    label: "Errors",
    color: "hsl(var(--destructive))",
  },
}

const CustomTooltip = ({ active, payload, breakdownBy, breakdownOptions }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ErrorTrendDataPoint;
    const breakdownTitle = breakdownOptions.find((o: any) => o.value === breakdownBy)?.label || 'Breakdown';
    
    const specificBreakdown = data.breakdown?.[breakdownBy];
    const breakdownEntries = specificBreakdown ? Object.entries(specificBreakdown).sort(([, a], [, b]) => b - a) : [];

    const formatBreakdownKey = (key: string) => {
        if (breakdownBy === 'repository_path') {
            const lastSlashIndex = key.lastIndexOf('/');
            return lastSlashIndex !== -1 ? key.substring(lastSlashIndex + 1) : key;
        }
        if (key === '') {
            return '<empty>';
        }
        return key;
    };

    return (
      <div className="min-w-[12rem] rounded-lg border bg-background p-2 text-xs shadow-lg">
        <div className="mb-2">
          <p className="font-bold text-sm">{data.fullDate}</p>
          <p className="text-muted-foreground">{`Total Errors: ${data.count}`}</p>
        </div>
        {breakdownEntries.length > 0 && (
          <div className="pt-2 border-t">
            <p className="font-semibold mb-1">By {breakdownTitle} (Top 5)</p>
            <div className="space-y-1">
              {breakdownEntries.slice(0, 5).map(([key, count]) => {
                const formattedKey = formatBreakdownKey(key);
                const titleText = key === '' ? '<empty>' : key;
                return (
                    <div key={key} className="flex justify-between items-center text-muted-foreground" title={titleText}>
                        <span className="truncate">{formattedKey}</span>
                        <span className="font-medium text-foreground ml-2">{count}</span>
                    </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};


export function ErrorTrendChart({ data, isLoading, breakdownBy, setBreakdownBy, breakdownOptions }: ErrorTrendChartProps) {
  const totalErrors = React.useMemo(() => {
    if (!data) return 0;
    return data.reduce((acc, current) => acc + current.count, 0);
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
            <CardDescription>
                The frequency of errors over the selected time period. Total Errors : {totalErrors.toLocaleString()}
            </CardDescription>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Breakdown By</span>
            <Select value={breakdownBy} onValueChange={(value) => setBreakdownBy(value as ChartBreakdownByOption)} disabled={isLoading || breakdownOptions.length === 0}>
                <SelectTrigger className="w-full sm:w-[180px]">
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
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground">
              No data available to display. Select a time range to start.
          </div>
        ) : (
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
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={false}
                content={<CustomTooltip breakdownBy={breakdownBy} breakdownOptions={breakdownOptions} />}
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
        )}
      </CardContent>
    </Card>
  )
}
