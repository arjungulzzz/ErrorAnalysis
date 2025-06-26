
"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Skeleton } from "./ui/skeleton";
import { type ErrorTrendDataPoint } from "@/types";

interface ErrorTrendChartProps {
  data: ErrorTrendDataPoint[];
  isLoading: boolean;
}

const chartConfig = {
  errors: {
    label: "Errors",
    color: "hsl(var(--destructive))",
  },
}

export function ErrorTrendChart({ data, isLoading }: ErrorTrendChartProps) {
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
      <CardHeader>
        <CardTitle>Error Trend</CardTitle>
        <CardDescription>
          The frequency of errors over the selected time period.
        </CardDescription>
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
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(_label, payload) => {
                    const fullDate = payload?.[0]?.payload?.date;
                    if (fullDate) {
                      // The date string 'YYYY-MM-DD' is parsed as UTC. Using toLocaleDateString
                      // with the UTC timezone prevents off-by-one-day errors.
                      return new Date(fullDate).toLocaleDateString('en-US', {
                        timeZone: 'UTC',
                      });
                    }
                    return null;
                  }}
                />
              }
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
