/**
 * @fileoverview
 * The main component for the Error Insights Dashboard.
 * This component manages the state for the entire dashboard, including data fetching,
 * filters (date range, grouping, column visibility), and layout of sub-components
 * like the error table and trend chart.
 */
"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { type ErrorLog, type SortDescriptor, type ColumnFilters, type GroupByOption, type ErrorTrendDataPoint, type ApiErrorLog, type ChartBreakdownByOption, type GroupDataPoint, type LogsApiResponse, type LogsApiRequest } from "@/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorTable } from "@/components/error-table";
import { type DateRange } from "react-day-picker";
import { format, subDays, subMonths, addMonths, subHours } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCw, ChevronDown, Calendar as CalendarIcon, X } from "lucide-react";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ErrorTrendChart } from "./error-trend-chart";
import { useToast } from "@/hooks/use-toast";
import pako from "pako";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";

interface DashboardViewState {
  columnFilters: ColumnFilters;
  dateRange?: DateRange;
  timePreset: string;
  sort: SortDescriptor;
  groupBy: GroupByOption;
  columnVisibility: Partial<Record<keyof ErrorLog, boolean>>;
  chartBreakdownBy: ChartBreakdownByOption;
  columnWidths: Record<keyof ErrorLog, number>;
}

const allColumns: { id: keyof ErrorLog; name: string }[] = [
    { id: 'log_date_time', name: 'Timestamp' },
    { id: 'host_name', name: 'Host' },
    { id: 'repository_path', name: 'Model Name' },
    { id: 'port_number', name: 'Port' },
    { id: 'version_number', name: 'AS Version' },
    { id: 'as_server_mode', name: 'Server Mode' },
    { id: 'as_start_date_time', name: 'Server Start Time' },
    { id: 'as_server_config', name: 'Server Config' },
    { id: 'user_id', name: 'User' },
    { id: 'report_id_name', name: 'Report Name' },
    { id: 'error_number', name: 'Error Code' },
    { id: 'xql_query_id', name: 'Query ID' },
    { id: 'log_message', name: 'Message' },
];

const TIME_PRESETS = [
    { value: 'none', label: 'None', interval: null },
    { value: '4 hours', label: 'Last 4 hours', interval: '4 hours' },
    { value: '8 hours', label: 'Last 8 hours', interval: '8 hours' },
    { value: '1 day', label: 'Last 1 day', interval: '1 day' },
    { value: '7 days', label: 'Last 7 days', interval: '7 days' },
    { value: '15 days', label: 'Last 15 days', interval: '15 days' },
    { value: '1 month', label: 'Last 1 month', interval: '1 month' },
];

export default function ErrorDashboard() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [chartData, setChartData] = useState<ErrorTrendDataPoint[]>([]);
  const [groupData, setGroupData] = useState<GroupDataPoint[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [timePreset, setTimePreset] = useState<string>('none');
  const [sort, setSort] = useState<SortDescriptor>({ column: 'log_date_time', direction: 'descending' });
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [columnVisibility, setColumnVisibility] = useState<Partial<Record<keyof ErrorLog, boolean>>>({
    log_date_time: true,
    host_name: true,
    repository_path: true,
    port_number: false,
    version_number: true,
    as_server_mode: false,
    as_start_date_time: false,
    as_server_config: false,
    user_id: true,
    report_id_name: false,
    error_number: false,
    xql_query_id: false,
    log_message: true,
  });
  
  const [isPending, startTransition] = useTransition();
  const [chartBreakdownBy, setChartBreakdownBy] = useState<ChartBreakdownByOption>('host_name');
  
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const { toast } = useToast();
  
  const [isClient, setIsClient] = useState(false);
  
  const [columnWidths, setColumnWidths] = useState<Record<keyof ErrorLog, number>>({} as Record<keyof ErrorLog, number>);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load dashboard state from local storage on initial client render
  useEffect(() => {
      if (!isClient) return;
      try {
          const savedStateRaw = localStorage.getItem('error-dashboard-view-state');
          const defaultWidths = allColumns.reduce((acc, col) => {
              acc[col.id] = col.id === 'log_message' ? 400 : col.id === 'log_date_time' ? 180 : 150;
              return acc;
          }, {} as Record<keyof ErrorLog, number>);

          if (savedStateRaw) {
              const savedState = JSON.parse(savedStateRaw) as Partial<DashboardViewState>;
              
              if (savedState.columnFilters) setColumnFilters(savedState.columnFilters);
              if (savedState.dateRange) {
                  const restoredDateRange = {
                      from: savedState.dateRange.from ? new Date(savedState.dateRange.from) : undefined,
                      to: savedState.dateRange.to ? new Date(savedState.dateRange.to) : undefined,
                  };
                  setDateRange(restoredDateRange);
              }
              if (savedState.timePreset) setTimePreset(savedState.timePreset);
              if (savedState.sort) setSort(savedState.sort);
              if (savedState.groupBy) setGroupBy(savedState.groupBy);
              if (savedState.columnVisibility) setColumnVisibility(savedState.columnVisibility);
              if (savedState.chartBreakdownBy) setChartBreakdownBy(savedState.chartBreakdownBy);
              
              const validatedWidths = allColumns.reduce((acc, col) => {
                  acc[col.id] = savedState.columnWidths?.[col.id] || defaultWidths[col.id];
                  return acc;
              }, {} as Record<keyof ErrorLog, number>);
              setColumnWidths(validatedWidths);
          } else {
              setColumnWidths(defaultWidths);
          }
      } catch (error) {
          console.error("Failed to parse dashboard state from localStorage", error);
          const defaultWidths = allColumns.reduce((acc, col) => {
            acc[col.id] = col.id === 'log_message' ? 400 : col.id === 'log_date_time' ? 180 : 150;
            return acc;
          }, {} as Record<keyof ErrorLog, number>);
          setColumnWidths(defaultWidths);
      }
  }, [isClient]);

  // Save dashboard state to local storage whenever it changes
  useEffect(() => {
      if (!isClient || Object.keys(columnWidths).length === 0) return;

      const stateToSave: DashboardViewState = {
        columnFilters,
        dateRange,
        timePreset,
        sort,
        groupBy,
        columnVisibility,
        chartBreakdownBy,
        columnWidths
      };
      
      localStorage.setItem('error-dashboard-view-state', JSON.stringify(stateToSave));
  }, [
      columnFilters, 
      dateRange, 
      timePreset, 
      sort, 
      groupBy, 
      columnVisibility, 
      chartBreakdownBy, 
      columnWidths, 
      isClient
  ]);

  const fetchData = useCallback(() => {
    startTransition(async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        toast({
          variant: "destructive",
          title: "Configuration Error",
          description: "The API URL is not configured. Please set NEXT_PUBLIC_API_URL in your environment.",
        });
        setLogs([]);
        setTotalLogs(0);
        setChartData([]);
        setGroupData([]);
        return;
      }

      if (timePreset === 'none') {
        setLogs([]);
        setTotalLogs(0);
        setChartData([]);
        setGroupData([]);
        return;
      }

      const requestId = `req_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;

      const requestBody: LogsApiRequest = {
        requestId,
        interval: timePreset !== 'custom' ? timePreset : null,
        dateRange: timePreset === 'custom' ? dateRange : undefined,
        pagination: { page, pageSize },
        sort: sort.column && sort.direction ? sort : { column: 'log_date_time', direction: 'descending' },
        filters: columnFilters,
        groupBy,
        chartBreakdownBy,
      };

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(errorData.message || `API request failed with status ${response.status}`);
        }

        let data: LogsApiResponse;
        if (response.headers.get("X-Compressed") === "true") {
            const blob = await response.blob();
            const compressedData = await new Response(blob).arrayBuffer();
            const decompressedData = pako.inflate(new Uint8Array(compressedData), { to: 'string' });
            data = JSON.parse(decompressedData);
        } else {
            data = await response.json();
        }

        // Process API response: convert date strings to Date objects and ensure a unique ID
        const processedLogs: ErrorLog[] = data.logs.map((log: ApiErrorLog, index: number) => ({
          ...log,
          id: `log-${new Date(log.log_date_time).getTime()}-${index}`,
          log_date_time: new Date(log.log_date_time),
          as_start_date_time: new Date(log.as_start_date_time),
        }));

        setLogs(processedLogs);
        setTotalLogs(data.totalCount);
        setChartData(data.chartData || []);
        setGroupData(data.groupData || []);

      } catch (error) {
        console.error("Failed to fetch logs:", error);
        toast({
          variant: "destructive",
          title: "Failed to Fetch Data",
          description: error instanceof Error ? error.message : "An unknown error occurred.",
        });
        setLogs([]);
        setTotalLogs(0);
        setChartData([]);
        setGroupData([]);
      }
    });
  }, [page, pageSize, sort, columnFilters, groupBy, dateRange, timePreset, chartBreakdownBy, toast]);
  
  useEffect(() => {
    // Reset page to 1 whenever filters, grouping, or date changes
    setPage(1);
  }, [columnFilters, groupBy, dateRange, timePreset, sort]);

  useEffect(() => {
    // Main fetch trigger
    if (isClient) { // Only fetch data on the client
      fetchData();
    }
  }, [fetchData, isClient]);

  const handleGroupSelect = (groupKey: string) => {
    if (groupBy !== 'none') {
        setColumnFilters(prev => ({ ...prev, [groupBy]: groupKey }));
        setGroupBy('none');
    }
  };
  
  const handlePresetSelect = (value: string) => {
    setTimePreset(value);
    
    if (value === 'none') {
        setDateRange(undefined);
        setDatePickerOpen(false);
        return;
    }
    
    const now = new Date();
    let fromDate: Date | undefined;
    switch (value) {
      case "4 hours":
        fromDate = subHours(now, 4);
        break;
      case "8 hours":
        fromDate = subHours(now, 8);
        break;
      case "1 day":
        fromDate = subDays(now, 1);
        break;
      case "7 days":
        fromDate = subDays(now, 7);
        break;
      case "15 days":
        fromDate = subDays(now, 15);
        break;
      case "1 month":
        fromDate = subMonths(now, 1);
        break;
    }
    setDateRange({ from: fromDate, to: now });
    setDatePickerOpen(false);
  };
  
  const handleRefresh = () => {
    fetchData();
  };
  
  const activeFilters = Object.entries(columnFilters).filter(([, value]) => !!value);

  return (
    <div className="space-y-6">
       <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-lg bg-primary text-primary-foreground border-b-4 border-accent">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AS Errors Dashboard</h1>
          <p className="text-primary-foreground/80">An interface for analyzing application error logs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} disabled={isPending || timePreset === 'none'} variant="outline" className="bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20 text-primary-foreground">
            <RotateCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="date-picker-trigger">Time Range</Label>
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                id="date-picker-trigger"
                                variant={"outline"}
                                disabled={isPending || !isClient}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    timePreset === 'none' && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {timePreset === 'custom' ? (
                                    dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                                {format(dateRange.to, "LLL dd, y")}
                                            </>
                                        ) : (
                                            format(dateRange.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Pick a date</span>
                                    )
                                ) : (
                                    TIME_PRESETS.find(p => p.value === timePreset)?.label || 'Select time range...'
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 flex" align="start">
                            <div className="flex flex-col gap-1 p-2 border-r">
                                {TIME_PRESETS.map(p => (
                                    <Button 
                                        key={p.value}
                                        variant={timePreset === p.value ? "secondary" : "ghost"}
                                        size="sm"
                                        className="justify-start"
                                        onClick={() => handlePresetSelect(p.value)}
                                        disabled={isPending || !isClient}
                                    >
                                        {p.label}
                                    </Button>
                                ))}
                            </div>
                            {isClient ? (() => {
                                const today = new Date();
                                const defaultMonth = (() => {
                                    if (!dateRange?.from) return subMonths(today, 1);
                                    const isFromInCurrentMonth = dateRange.from.getMonth() === today.getMonth() && dateRange.from.getFullYear() === today.getFullYear();
                                    if (isFromInCurrentMonth) {
                                        const isToInCurrentMonth = !dateRange.to || (dateRange.to.getMonth() === today.getMonth() && dateRange.to.getFullYear() === today.getFullYear());
                                        if (isToInCurrentMonth) return subMonths(today, 1);
                                    }
                                    return dateRange.from;
                                })();

                                return (
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={defaultMonth}
                                        selected={dateRange}
                                        onSelect={(range) => {
                                            setDateRange(range);
                                            setTimePreset('custom');
                                            if (range?.from && range.to) {
                                              setDatePickerOpen(false);
                                            }
                                        }}
                                        numberOfMonths={2}
                                        fromDate={subMonths(today, 1)}
                                        toDate={today}
                                        disabled={isPending ? true : (date: Date) => {
                                            if (date > today) return true;
                                            if (dateRange?.from && !dateRange.to) {
                                                const oneMonthFromStart = addMonths(dateRange.from, 1);
                                                if (date > oneMonthFromStart) return true;
                                            }
                                            return false;
                                        }}
                                    />
                                );
                            })() : (
                                <div className="p-3 w-[574px] h-[352px] flex items-center justify-center">
                                    <RotateCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="group-by-trigger">Group By</Label>
                    <Select onValueChange={(value) => setGroupBy(value as GroupByOption)} value={groupBy} disabled={isPending}>
                        <SelectTrigger className="w-full" id="group-by-trigger">
                            <SelectValue placeholder="Group by..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="host_name">Host</SelectItem>
                            <SelectItem value="repository_path">Model Name</SelectItem>
                            <SelectItem value="error_number">Error Code</SelectItem>
                            <SelectItem value="user_id">User</SelectItem>
                            <SelectItem value="version_number">AS Version</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="view-options-trigger">View Options</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between" disabled={isPending} id="view-options-trigger">
                          <span>Toggle columns</span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto">
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
            {activeFilters.length > 0 && (
                <div className="pt-4 border-t border-dashed">
                    <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-sm font-medium">Active Filters</h4>
                        <Button 
                            variant="link" 
                            className="h-auto p-0 text-sm"
                            onClick={() => setColumnFilters({})}
                            disabled={isPending}
                        >
                            Clear all
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {activeFilters.map(([key, value]) => {
                            const column = allColumns.find(c => c.id === key);
                            if (!column) return null;

                            return (
                                <Badge key={key} variant="secondary" className="pl-2 pr-1 py-1 text-sm font-normal">
                                    <span className="font-semibold mr-1">{column.name}:</span>
                                    <span className="mr-1 truncate max-w-xs">{String(value)}</span>
                                    <button 
                                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 disabled:opacity-50"
                                        onClick={() => {
                                            setColumnFilters(prev => ({
                                                ...prev,
                                                [key]: ''
                                            }));
                                        }}
                                        disabled={isPending}
                                    >
                                        <span className="sr-only">Remove {column.name} filter</span>
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            );
                        })}
                    </div>
                </div>
            )}
        </CardContent>
      </Card>
      
      <ErrorTable 
        logs={logs} 
        isLoading={isPending}
        sortDescriptor={sort}
        setSortDescriptor={setSort}
        page={page}
        pageSize={pageSize}
        totalLogs={totalLogs}
        setPage={setPage}
        groupBy={groupBy}
        groupData={groupData}
        onGroupSelect={handleGroupSelect}
        columnFilters={columnFilters}
        setColumnFilters={setColumnFilters}
        columnVisibility={columnVisibility}
        allColumns={allColumns}
        columnWidths={columnWidths}
        setColumnWidths={setColumnWidths}
      />
      <div className="mt-6">
        <ErrorTrendChart 
          data={chartData} 
          isLoading={isPending}
          breakdownBy={chartBreakdownBy}
          setBreakdownBy={setChartBreakdownBy}
        />
      </div>
    </div>
  );
}
