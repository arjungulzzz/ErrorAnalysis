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
import { ErrorTable } from "@/components/error-table";
import { type DateRange } from "react-day-picker";
import { format, subDays, subMonths, addMonths, subHours } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
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
import { processMockRequest } from "@/lib/mock-api";

interface DashboardViewState {
  columnFilters: ColumnFilters;
  dateRange?: DateRange;
  timePreset: string;
  sort: SortDescriptor;
  groupBy: GroupByOption[];
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

const nonGroupableColumns: Array<keyof ErrorLog> = ['log_date_time', 'as_start_date_time', 'log_message'];

export default function ErrorDashboard() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [chartData, setChartData] = useState<ErrorTrendDataPoint[]>([]);
  const [groupData, setGroupData] = useState<GroupDataPoint[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [timePreset, setTimePreset] = useState<string>('7 days');
  const [sort, setSort] = useState<SortDescriptor>({ column: 'log_date_time', direction: 'descending' });
  const [groupBy, setGroupBy] = useState<GroupByOption[]>([]);
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
    error_number: true,
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
              if (savedState.groupBy && Array.isArray(savedState.groupBy)) setGroupBy(savedState.groupBy);
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

      const requestId = `req_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;

      const requestBody: LogsApiRequest = {
        requestId,
        interval: timePreset !== 'custom' ? timePreset : null,
        dateRange: dateRange, // Always send the dateRange object to the mock service
        pagination: { page, pageSize },
        sort: sort.column && sort.direction ? sort : { column: 'log_date_time', direction: 'descending' },
        filters: columnFilters,
        groupBy,
        chartBreakdownBy,
      };

      if (!apiUrl) {
        if (timePreset === 'none') {
            setLogs([]);
            setTotalLogs(0);
            setChartData([]);
            setGroupData([]);
            return;
        }
        
        try {
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 300));
            const data = processMockRequest(requestBody);

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
            
            // Only show toast on first mock load
            if (page === 1 && !Object.values(columnFilters).some(v => v)) {
                 toast({
                    title: "Using Mock Data",
                    description: "NEXT_PUBLIC_API_URL is not set. Displaying mock data.",
                });
            }

        } catch (error) {
            console.error("Failed to process mock data:", error);
            toast({
                variant: "destructive",
                title: "Mock Data Error",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
            setLogs([]);
            setTotalLogs(0);
            setChartData([]);
            setGroupData([]);
        }
        return;
      }

      if (timePreset === 'none') {
        setLogs([]);
        setTotalLogs(0);
        setChartData([]);
        setGroupData([]);
        return;
      }

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
  
  const availableGroupByOptions = allColumns.filter(
    (col) => !nonGroupableColumns.includes(col.id) && columnVisibility[col.id]
  );
  
  const handleVisibilityChange = (columnId: keyof ErrorLog, value: boolean) => {
    if (!value && groupBy.includes(columnId as GroupByOption)) {
        setGroupBy(prev => prev.filter(g => g !== columnId));
    }
    setColumnVisibility(prev => ({
        ...prev,
        [columnId]: !!value,
    }));
  };

  const handleDeselectAllColumns = () => {
    setColumnVisibility(
      Object.fromEntries(allColumns.map(col => [col.id, false]))
    );
    setGroupBy([]);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-lg bg-primary text-primary-foreground border-b-4 border-accent">
        <div className="flex items-center gap-4">
          <div className="flex h-8 w-8 items-center justify-center">
            <svg width="35" height="32" viewBox="0 0 35 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M10.6691 1.7208L0.666992 18.2736C-0.0886745 19.5392 -0.219508 21.036 0.354658 22.4299C0.928825 23.8238 2.16416 24.9749 3.66806 25.6456L15.3421 30.7391C16.846 31.4098 18.5445 31.4098 20.0484 30.7391L31.7224 25.6456C33.2263 24.9749 34.4616 23.8238 35.0358 22.4299C35.61 21.036 35.4791 19.5392 34.7235 18.2736L24.7214 1.7208C23.9657 0.455201 22.6109 -0.252066 21.1448 -0.252066H14.2497C12.7836 -0.252066 11.4288 0.455201 10.6732 1.7208H10.6691Z" fill="url(#paint0_linear_103_2)"/>
              <path d="M17.7021 17.5137L8.91699 15.2505L10.6698 12.0003L17.7021 13.9189V17.5137Z" fill="#A2E5E6"/>
              <path d="M17.7019 17.5137V13.9189L24.7205 12.0003L26.4733 15.2505L17.7019 17.5137Z" fill="url(#paint1_linear_103_2)"/>
              <path d="M17.7019 19.2319V29.8052L31.7231 24.1852L26.4727 15.2505L17.7019 19.2319Z" fill="url(#paint2_linear_103_2)"/>
              <path d="M8.91699 15.2505L3.6666 24.1852L17.7019 29.8052V19.2319L8.91699 15.2505Z" fill="#008284"/>
              <path d="M10.6698 12.0003L8.91699 15.2505L3.6666 5.81525L10.6698 1.7208L17.7021 13.9189L10.6698 12.0003Z" fill="#A2E5E6"/>
              <path d="M24.7205 12.0003L17.7021 13.9189L24.7205 1.7208L31.7238 5.81525L26.4733 15.2505L24.7205 12.0003Z" fill="url(#paint3_linear_103_2)"/>
              <defs>
              <linearGradient id="paint0_linear_103_2" x1="17.7022" y1="-0.252066" x2="17.7022" y2="31.1448" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00A0A2"/>
              <stop offset="1" stopColor="#005B5C"/>
              </linearGradient>
              <linearGradient id="paint1_linear_103_2" x1="22.0977" y1="12.0003" x2="22.0977" y2="17.5137" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A2E5E6"/>
              <stop offset="1" stopColor="#00A0A2"/>
              </linearGradient>
              <linearGradient id="paint2_linear_103_2" x1="24.7123" y1="15.2505" x2="24.7123" y2="29.8052" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A2E5E6"/>
              <stop offset="1" stopColor="#00A0A2"/>
              </linearGradient>
              <linearGradient id="paint3_linear_103_2" x1="24.712" y1="1.7208" x2="24.712" y2="15.2505" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A2E5E6"/>
              <stop offset="1" stopColor="#00A0A2"/>
              </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">AS Errors Dashboard</h1>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between" disabled={isPending} id="group-by-trigger">
                          <span>Group By {groupBy.length > 0 && `(${groupBy.length})`}</span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Group by columns</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setGroupBy([])} disabled={groupBy.length === 0}>
                            Clear grouping
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {availableGroupByOptions.map((option) => (
                              <DropdownMenuCheckboxItem
                                  key={option.id}
                                  checked={groupBy.includes(option.id as GroupByOption)}
                                  onCheckedChange={(checked) => {
                                      setGroupBy(current =>
                                          checked
                                              ? [...current, option.id as GroupByOption]
                                              : current.filter(item => item !== option.id)
                                      );
                                  }}
                                  onSelect={(e) => e.preventDefault()}
                              >
                                  {option.name}
                              </DropdownMenuCheckboxItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                            <DropdownMenuItem onSelect={handleDeselectAllColumns}>
                              Deselect All
                            </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {allColumns.map((column) => (
                              <DropdownMenuCheckboxItem
                                  key={column.id}
                                  className="capitalize"
                                  checked={columnVisibility[column.id] ?? false}
                                  onCheckedChange={(value) => handleVisibilityChange(column.id, !!value)}
                                  onSelect={(e) => e.preventDefault()}
                              >
                                  {column.name}
                              </DropdownMenuCheckboxItem>
                          ))}
                      </DropdownMenuContent>
                  </DropdownMenu>
                </div>
            </div>
            {(activeFilters.length > 0 || groupBy.length > 0) && (
                <div className="pt-4 border-t border-dashed space-y-4">
                    {activeFilters.length > 0 && (
                        <div>
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
                    {groupBy.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <h4 className="text-sm font-medium">Grouping Order</h4>
                                <Button 
                                    variant="link" 
                                    className="h-auto p-0 text-sm"
                                    onClick={() => setGroupBy([])}
                                    disabled={isPending}
                                >
                                    Clear grouping
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {groupBy.map((groupKey) => {
                                const column = allColumns.find(c => c.id === groupKey);
                                return (
                                  <Badge key={groupKey} variant="secondary" className="pl-2 pr-1 py-1 text-sm font-normal">
                                    <span className="mr-1 truncate max-w-xs">{column?.name || groupKey}</span>
                                    <button
                                      className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 disabled:opacity-50"
                                      onClick={() => setGroupBy(current => current.filter(item => item !== groupKey))}
                                      disabled={isPending}
                                    >
                                      <span className="sr-only">Remove {column?.name} grouping</span>
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                );
                              })}
                            </div>
                        </div>
                    )}
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
