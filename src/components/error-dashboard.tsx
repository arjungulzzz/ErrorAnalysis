"use client";

import { useState, useEffect, useCallback, useTransition, useMemo } from "react";
import { type ErrorLog, type SortDescriptor, type GroupedLogs, type ColumnFilters } from "@/types";
import { getErrorLogs } from "@/app/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorTable } from "@/components/error-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { type DateRange } from "react-day-picker";
import { subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCw } from "lucide-react";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";

export default function ErrorDashboard() {
  const [data, setData] = useState<ErrorLog[]>([]);
  const [anomalousLogIds, setAnomalousLogIds] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 7), to: new Date() });
  const [sort, setSort] = useState<SortDescriptor>({ column: 'log_date_time', direction: 'descending' });
  const [groupByUser, setGroupByUser] = useState(false);
  
  const [isPending, startTransition] = useTransition();

  const fetchLogs = useCallback(() => {
    startTransition(async () => {
      const result = await getErrorLogs({
        columnFilters,
        dateRange,
        page,
        pageSize,
        sort,
      });
      setData(result.logs);
      setTotal(result.total);
      setAnomalousLogIds(result.anomalousLogIds);
    });
  }, [columnFilters, dateRange, page, pageSize, sort]);
  
  useEffect(() => {
    setPage(1);
  }, [columnFilters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const groupedData = useMemo((): GroupedLogs | null => {
    if (!groupByUser) return null;
    
    const groups: GroupedLogs = {};
    
    data.forEach(log => {
        if (!groups[log.user_id]) {
            groups[log.user_id] = { logs: [], count: 0, anomalousCount: 0 };
        }
        groups[log.user_id].logs.push(log);
        groups[log.user_id].count++;
        if (anomalousLogIds.includes(log.id)) {
            groups[log.user_id].anomalousCount++;
        }
    });

    for (const userId in groups) {
        groups[userId].logs.sort((a, b) => new Date(b.log_date_time).getTime() - new Date(a.log_date_time).getTime());
    }

    return groups;
  }, [data, groupByUser, anomalousLogIds]);

  const handleTimePresetChange = (value: string) => {
    const now = new Date();
    let fromDate: Date | undefined;
    switch (value) {
      case "4h":
        fromDate = subDays(now, 1/6);
        break;
      case "8h":
        fromDate = subDays(now, 1/3);
        break;
      case "1d":
        fromDate = subDays(now, 1);
        break;
      case "7d":
        fromDate = subDays(now, 7);
        break;
      case "all":
        setDateRange(undefined);
        setPage(1);
        return;
    }
    setDateRange({ from: fromDate, to: now });
    setPage(1);
  };
  
  const handleRefresh = () => {
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Error Insights Dashboard</h1>
          <p className="text-muted-foreground">Analyze and investigate application errors.</p>
        </div>
        <Button onClick={handleRefresh} disabled={isPending}>
          <RotateCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </header>

      <Card>
        <CardHeader>
            <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex flex-wrap items-end gap-4">
                <div>
                    <label htmlFor="time-preset" className="text-sm font-medium">Time Range</label>
                    <Select onValueChange={handleTimePresetChange} defaultValue="7d">
                    <SelectTrigger className="w-[180px] mt-1">
                        <SelectValue placeholder="Select a time range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="4h">Last 4 hours</SelectItem>
                        <SelectItem value="8h">Last 8 hours</SelectItem>
                        <SelectItem value="1d">Last 1 day</SelectItem>
                        <SelectItem value="7d">Last 1 week</SelectItem>
                        <SelectItem value="all">All time</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
                <div>
                    <label className="text-sm font-medium">Custom Range</label>
                    <DateRangePicker 
                      date={dateRange}
                      onDateChange={(range) => {
                        setDateRange(range);
                        setPage(1);
                      }}
                      className="mt-1"
                    />
                </div>
                 <div className="flex items-center space-x-2 pt-5">
                    <Switch
                        id="group-by-user"
                        checked={groupByUser}
                        onCheckedChange={(checked) => {
                        setGroupByUser(checked);
                        setPage(1);
                        }}
                    />
                    <Label htmlFor="group-by-user">Group by User</Label>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <ErrorTable 
        logs={data} 
        isLoading={isPending}
        sortDescriptor={sort}
        setSortDescriptor={setSort}
        anomalousLogIds={anomalousLogIds}
        page={page}
        pageSize={pageSize}
        totalLogs={total}
        setPage={setPage}
        groupingEnabled={groupByUser}
        groupedLogs={groupedData}
        columnFilters={columnFilters}
        setColumnFilters={setColumnFilters}
      />
    </div>
  );
}
