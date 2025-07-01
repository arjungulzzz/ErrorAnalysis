/**
 * @fileoverview
 * The main component for the Error Insights Dashboard.
 * This component manages the state for the entire dashboard, including data fetching,
 * filters (date range, grouping, column visibility), and layout of sub-components
 * like the error table and trend chart.
 */
"use client";

import { useState, useEffect, useCallback, useTransition, useMemo } from "react";
import { type ErrorLog, type SortDescriptor, type ColumnFilters, type GroupByOption, type ErrorTrendDataPoint, type ApiErrorLog, type ChartBreakdownByOption, type GroupDataPoint, type LogsApiResponse, type LogsApiRequest } from "@/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorTable } from "@/components/error-table";
import { type DateRange } from "react-day-picker";
import { format, subDays, subMonths, addMonths, subHours } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCw, ChevronDown, Calendar as CalendarIcon } from "lucide-react";
import { Label } from "./ui/label";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ErrorTrendChart } from "./error-trend-chart";
import * as pako from "pako";
import { useToast } from "@/hooks/use-toast";

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
    report_id_name: true,
    error_number: false,
    xql_query_id: false,
    log_message: true,
  });
  
  const [isPending, startTransition] = useTransition();
  const [chartBreakdownBy, setChartBreakdownBy] = useState<ChartBreakdownByOption>('host_name');
  
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const { toast } = useToast();
  const [renderStartTime, setRenderStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (renderStartTime) {
      const renderEndTime = performance.now();
      console.log(`UI render took: ${(renderEndTime - renderStartTime).toFixed(2)}ms`);
      setRenderStartTime(null);
    }
  }, [logs, renderStartTime]);

  const fetchData = useCallback(() => {
    startTransition(async () => {
      if (timePreset === 'none' || (timePreset === 'custom' && !dateRange?.from)) {
        setLogs([]);
        setTotalLogs(0);
        setChartData([]);
        setGroupData([]);
        return;
      }

      const externalApiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      if (!externalApiUrl) {
        console.error("API URL not configured. Set NEXT_PUBLIC_API_URL in .env");
        toast({
          variant: "destructive",
          title: "Configuration Error",
          description: "The application's API endpoint is not set.",
        });
        return;
      }
      
      try {
        const preset = TIME_PRESETS.find(p => p.value === timePreset);
        const requestBody: LogsApiRequest = {
          requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          ...(timePreset === 'custom' ? { dateRange } : { interval: preset?.interval }),
          pagination: { page, pageSize },
          sort,
          filters: columnFilters,
          groupBy,
          chartBreakdownBy,
        };

        const fetchStartTime = performance.now();
        const response = await fetch(externalApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        const responseReceivedTime = performance.now();
        console.log(`API response received (TTFB): ${(responseReceivedTime - fetchStartTime).toFixed(2)}ms`);

        if (!response.ok) {
          console.error("Failed to fetch logs:", response.statusText);
          toast({
            variant: "destructive",
            title: "Failed to fetch logs",
            description: "The API could not be reached. Please check your connection or try again later.",
          });
          return;
        }

        let apiResponse: LogsApiResponse;
        const isCompressed = response.headers.get('X-Compressed') === 'true';

        if (isCompressed) {
          const compressedData = await response.arrayBuffer();
          const bodyDownloadedTime = performance.now();
          console.log(`Body download took: ${(bodyDownloadedTime - responseReceivedTime).toFixed(2)}ms`);
          
          const decompressedData = pako.inflate(new Uint8Array(compressedData), { to: 'string' });
          const decompressionDoneTime = performance.now();
          console.log(`Decompression took: ${(decompressionDoneTime - bodyDownloadedTime).toFixed(2)}ms`);

          apiResponse = JSON.parse(decompressedData) as LogsApiResponse;
          const jsonParsedTime = performance.now();
          console.log(`JSON parsing took: ${(jsonParsedTime - decompressionDoneTime).toFixed(2)}ms`);
        } else {
          apiResponse = await response.json();
          const bodyParsedTime = performance.now();
          console.log(`Body download & parsing took: ${(bodyParsedTime - responseReceivedTime).toFixed(2)}ms`);
        }
        
        const processingStartTime = performance.now();
        const { logs: apiLogs, totalCount, chartData: apiChartData, groupData: apiGroupData } = apiResponse;
        
        const processedLogs = apiLogs.map((log: ApiErrorLog) => ({
          ...log,
          log_date_time: new Date(log.log_date_time),
          as_start_date_time: new Date(log.as_start_date_time),
        }));
        
        setLogs(processedLogs);
        setTotalLogs(totalCount);
        setChartData(apiChartData);
        setGroupData(apiGroupData);

        const processingEndTime = performance.now();
        console.log(`Data processing took: ${(processingEndTime - processingStartTime).toFixed(2)}ms`);
        setRenderStartTime(performance.now());
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          variant: "destructive",
          title: "Failed to fetch logs",
          description: "An error occurred while processing the data. Please try again.",
        });
      }
    });
  }, [page, pageSize, sort, columnFilters, groupBy, chartBreakdownBy, dateRange, timePreset, toast]);
  
  useEffect(() => {
    // Reset page to 1 whenever filters, grouping, or date changes
    setPage(1);
  }, [columnFilters, groupBy, dateRange, timePreset, sort]);

  useEffect(() => {
    // Main fetch trigger
    fetchData();
  }, [fetchData]);

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

  const calendarDefaultMonth = useMemo(() => {
    const today = new Date();
    if (!dateRange?.from) {
      return subMonths(today, 1);
    }
    
    const isFromInCurrentMonth = dateRange.from.getMonth() === today.getMonth() && dateRange.from.getFullYear() === today.getFullYear();
    
    if (isFromInCurrentMonth) {
      const isToInCurrentMonth = !dateRange.to || (dateRange.to.getMonth() === today.getMonth() && dateRange.to.getFullYear() === today.getFullYear());
      if (isToInCurrentMonth) {
        return subMonths(today, 1);
      }
    }
    
    return dateRange.from;
  }, [dateRange]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">AS Error Table</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} disabled={isPending || timePreset === 'none'}>
            <RotateCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
            <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex flex-wrap items-end gap-4">
                <div>
                    <Label className="block text-sm font-medium mb-1">Time Range</Label>
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                disabled={isPending}
                                className={cn(
                                    "w-[260px] justify-start text-left font-normal",
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
                                    TIME_PRESETS.find(p => p.value === timePreset)?.label
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
                                        disabled={isPending}
                                    >
                                        {p.label}
                                    </Button>
                                ))}
                            </div>
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={calendarDefaultMonth}
                                selected={dateRange}
                                onSelect={(range) => {
                                    setDateRange(range);
                                    setTimePreset('custom');
                                    if (range?.from && range.to) {
                                      setDatePickerOpen(false);
                                    }
                                }}
                                numberOfMonths={2}
                                fromDate={subMonths(new Date(), 1)}
                                toDate={new Date()}
                                disabled={isPending ? true : (date: Date) => {
                                    const today = new Date();
                                
                                    if (date > today) return true;

                                    if (dateRange?.from && !dateRange.to) {
                                        const oneMonthFromStart = addMonths(dateRange.from, 1);
                                        if (date > oneMonthFromStart) {
                                            return true;
                                        }
                                    }
                                
                                    return false;
                                }}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                <div>
                    <Label htmlFor="group-by" className="text-sm font-medium">Group By</Label>
                    <Select onValueChange={(value) => setGroupBy(value as GroupByOption)} value={groupBy} disabled={isPending}>
                        <SelectTrigger className="w-[180px] mt-1" id="group-by">
                            <SelectValue placeholder="Select grouping" />
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
                 <div className="ml-auto">
                    <Label className="block text-sm font-medium">View Options</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-[180px] mt-1" disabled={isPending}>
                          Visible Columns <ChevronDown className="ml-auto h-4 w-4" />
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
