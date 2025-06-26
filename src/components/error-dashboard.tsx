"use client";

import { useState, useEffect, useCallback, useTransition, useMemo } from "react";
import { type ErrorLog, type SortDescriptor, type GroupedLogs, type ColumnFilters, type GroupByOption } from "@/types";
import { getErrorLogs } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorTable } from "@/components/error-table";
import { DateRangePicker } from "@/components/date-range-picker";
import { type DateRange } from "react-day-picker";
import { subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCw, ChevronDown } from "lucide-react";
import { Label } from "./ui/label";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const allColumns: { id: keyof ErrorLog; name: string }[] = [
    { id: 'log_date_time', name: 'Timestamp' },
    { id: 'host_name', name: 'Host' },
    { id: 'repository_path', name: 'Repository' },
    { id: 'port_number', name: 'Port' },
    { id: 'version_number', name: 'Version' },
    { id: 'as_server_mode', name: 'Server Mode' },
    { id: 'as_start_date_time', name: 'Server Start Time' },
    { id: 'as_server_config', name: 'Server Config' },
    { id: 'user_id', name: 'User' },
    { id: 'report_id_name', name: 'Report Name' },
    { id: 'error_number', name: 'Error Code' },
    { id: 'xql_query_id', name: 'Query ID' },
    { id: 'log_message', name: 'Message' },
];

export default function ErrorDashboard() {
  const [data, setData] = useState<ErrorLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 7), to: new Date() });
  const [sort, setSort] = useState<SortDescriptor>({ column: 'log_date_time', direction: 'descending' });
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [columnVisibility, setColumnVisibility] = useState<Partial<Record<keyof ErrorLog, boolean>>>({
    log_date_time: true,
    host_name: true,
    repository_path: true,
    port_number: true,
    version_number: true,
    as_server_mode: true,
    as_start_date_time: true,
    as_server_config: true,
    user_id: true,
    report_id_name: true,
    error_number: true,
    xql_query_id: true,
    log_message: true,
  });
  
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
    });
  }, [columnFilters, dateRange, page, pageSize, sort]);
  
  useEffect(() => {
    setPage(1);
  }, [columnFilters, groupBy]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const groupedData = useMemo((): GroupedLogs | null => {
    if (groupBy === 'none') return null;
    
    const groups: GroupedLogs = {};
    
    data.forEach(log => {
        const groupKey = String(log[groupBy]);
        if (!groups[groupKey]) {
            groups[groupKey] = { logs: [], count: 0 };
        }
        groups[groupKey].logs.push(log);
        groups[groupKey].count++;
    });

    for (const groupKey in groups) {
        groups[groupKey].logs.sort((a, b) => new Date(b.log_date_time).getTime() - new Date(a.log_date_time).getTime());
    }

    return groups;
  }, [data, groupBy]);

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
                    <Label htmlFor="time-preset" className="text-sm font-medium">Time Range</Label>
                    <Select onValueChange={handleTimePresetChange} defaultValue="7d">
                    <SelectTrigger className="w-[180px] mt-1" id="time-preset">
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
                    <Label className="text-sm font-medium">Custom Range</Label>
                    <DateRangePicker 
                      date={dateRange}
                      onDateChange={(range) => {
                        setDateRange(range);
                        setPage(1);
                      }}
                      className="mt-1"
                    />
                </div>
                <div>
                    <Label htmlFor="group-by" className="text-sm font-medium">Group By</Label>
                    <Select onValueChange={(value) => setGroupBy(value as GroupByOption)} value={groupBy}>
                        <SelectTrigger className="w-[180px] mt-1" id="group-by">
                            <SelectValue placeholder="Select grouping" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="host_name">Host</SelectItem>
                            <SelectItem value="repository_path">Repository</SelectItem>
                            <SelectItem value="error_number">Error Code</SelectItem>
                            <SelectItem value="user_id">User</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="ml-auto">
                    <Label className="block text-sm font-medium">View Options</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-[180px] mt-1">
                          Columns <ChevronDown className="ml-auto h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                           <DropdownMenuItem onSelect={() => setColumnVisibility(
                              Object.fromEntries(allColumns.map(col => [col.id, true]))
                            )}>
                              Select All
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setColumnVisibility(
                              Object.fromEntries(allColumns.map(col => [col.id, false]))
                            )}>
                              Deselect All
                            </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {allColumns.map((column) => (
                              <DropdownMenuCheckboxItem
                                  key={column.id}
                                  className="capitalize"
                                  checked={columnVisibility[column.id] ?? false}
                                  onCheckedChange={(value) =>
                                      setColumnVisibility((prev) => ({
                                          ...prev,
                                          [column.id]: !!value,
                                      }))
                                  }
                                  onSelect={(e) => e.preventDefault()}
                              >
                                  {column.name}
                              </DropdownMenuCheckboxItem>
                          ))}
                      </DropdownMenuContent>
                  </DropdownMenu>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <ErrorTable 
        logs={data} 
        isLoading={isPending}
        sortDescriptor={sort}
        setSortDescriptor={setSort}
        page={page}
        pageSize={pageSize}
        totalLogs={total}
        setPage={setPage}
        groupBy={groupBy}
        groupedLogs={groupedData}
        columnFilters={columnFilters}
        setColumnFilters={setColumnFilters}
        columnVisibility={columnVisibility}
      />
    </div>
  );
}
