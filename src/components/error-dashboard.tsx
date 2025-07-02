/**
 * @fileoverview
 * The main component for the Error Insights Dashboard.
 * This component manages the state for the entire dashboard, including data fetching,
 * filters (date range, grouping, column visibility), and layout of sub-components
 * like the error table and trend chart.
 */
"use client";

import { useState, useEffect, useCallback, useTransition, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { format, subDays, subHours, subMonths } from "date-fns";
import { type ErrorLog, type SortDescriptor, type ColumnFilters, type GroupByOption, type ErrorTrendDataPoint, type ApiErrorLog, type ChartBreakdownByOption, type GroupDataPoint, type LogsApiResponse, type LogsApiRequest, type ApiGroupDataPoint } from "@/types";
import { Button } from "@/components/ui/button";
import { ErrorTable } from "@/components/error-table";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCw, ChevronDown, X, Calendar as CalendarIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ErrorTrendChart } from "./error-trend-chart";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import Logo from './logo';

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

const timePresets = [
    { key: 'none', label: 'None', interval: null },
    { key: '1h', label: 'Last 1 hour', interval: '1 hour' },
    { key: '4h', label: 'Last 4 hours', interval: '4 hours' },
    { key: '8h', label: 'Last 8 hours', interval: '8 hours' },
    { key: '1d', label: 'Last 1 day', interval: '1 day' },
    { key: '7d', label: 'Last 7 days', interval: '7 days' },
    { key: '15d', label: 'Last 15 days', interval: '15 days' },
    { key: '1m', label: 'Last 1 month', interval: '1 month' },
];

export default function ErrorDashboard({ logoSrc, fallbackSrc }: { logoSrc: string; fallbackSrc: string }) {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [chartData, setChartData] = useState<ErrorTrendDataPoint[]>([]);
  const [groupData, setGroupData] = useState<GroupDataPoint[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedPreset, setSelectedPreset] = useState<string | null>('none');
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
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
    error_number: false,
    xql_query_id: false,
    log_message: true,
  });
  
  const [isPending, startTransition] = useTransition();
  const [chartBreakdownBy, setChartBreakdownBy] = useState<ChartBreakdownByOption>('host_name');
  
  const { toast } = useToast();
  
  const [columnWidths, setColumnWidths] = useState<Record<keyof ErrorLog, number>>(
    allColumns.reduce((acc, col) => {
      acc[col.id] = col.id === 'log_message' ? 400 : col.id === 'log_date_time' ? 180 : 150;
      return acc;
    }, {} as Record<keyof ErrorLog, number>)
  );
  
  const fetchData = useCallback(() => {
    startTransition(async () => {
      if (selectedPreset === 'none' && !dateRange?.from) {
        setLogs([]);
        setTotalLogs(0);
        setChartData([]);
        setGroupData([]);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        toast({
          variant: "destructive",
          title: "API URL Not Configured",
          description: "Please set NEXT_PUBLIC_API_URL in your environment.",
        });
        return;
      }

      const requestId = `req_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;
      const requestBody: LogsApiRequest = {
        requestId,
        pagination: { page, pageSize },
        sort: sort.column && sort.direction ? sort : { column: 'log_date_time', direction: 'descending' },
        filters: columnFilters,
        groupBy,
        chartBreakdownBy,
      };
      
      const preset = timePresets.find(p => p.key === selectedPreset);
      if (preset?.interval) {
        requestBody.interval = preset.interval;
      } else if (dateRange?.from) {
        requestBody.dateRange = {
            from: dateRange.from?.toISOString(),
            to: dateRange.to?.toISOString()
        };
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
        const data: LogsApiResponse = await response.json();

        const processLogs = (logs: ApiErrorLog[]): ErrorLog[] => {
            return logs.map((log: ApiErrorLog, index: number) => ({
                ...log,
                id: `log-${new Date(log.log_date_time).getTime()}-${index}`,
                log_date_time: new Date(log.log_date_time),
                as_start_date_time: new Date(log.as_start_date_time),
            }));
        };

        const processGroupData = (groups: ApiGroupDataPoint[]): GroupDataPoint[] => {
            return groups.map(group => ({
                ...group,
                subgroups: group.subgroups ? processGroupData(group.subgroups) : [],
            }));
        };
        
        setLogs(processLogs(data.logs));
        setTotalLogs(data.totalCount);
        setChartData(data.chartData || []);
        setGroupData(data.groupData ? processGroupData(data.groupData) : []);

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
  }, [page, pageSize, sort, columnFilters, groupBy, chartBreakdownBy, dateRange, selectedPreset, toast]);
  
  const fetchLogsForDrilldown = useCallback(async (drilldownFilters: ColumnFilters, page: number): Promise<{logs: ErrorLog[], totalCount: number}> => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
          toast({
              variant: "destructive",
              title: "API URL Not Configured",
              description: "Please set NEXT_PUBLIC_API_URL in your environment.",
          });
          return { logs: [], totalCount: 0 };
      }
      const requestId = `req_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;

      const requestBody: Omit<LogsApiRequest, 'groupBy'> & { groupBy: [] } = {
          requestId,
          pagination: { page, pageSize },
          sort: sort.column && sort.direction ? sort : { column: 'log_date_time', direction: 'descending' },
          filters: { ...columnFilters, ...drilldownFilters },
          groupBy: [],
          chartBreakdownBy: 'host_name', // Not used for this query, but required
      };

      const preset = timePresets.find(p => p.key === selectedPreset);
      if (preset?.interval) {
          requestBody.interval = preset.interval;
      } else if (dateRange?.from) {
          requestBody.dateRange = {
              from: dateRange.from?.toISOString(),
              to: dateRange.to?.toISOString()
          };
      }
      
      const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(errorData.message || `API request failed with status ${response.status}`);
      }
      const data: LogsApiResponse = await response.json();

      const processLogs = (logs: ApiErrorLog[]): ErrorLog[] => {
          return logs.map((log: ApiErrorLog, index: number) => ({
              ...log,
              id: `log-drilldown-${new Date(log.log_date_time).getTime()}-${index}`,
              log_date_time: new Date(log.log_date_time),
              as_start_date_time: new Date(log.as_start_date_time),
          }));
      };
      return { logs: processLogs(data.logs), totalCount: data.totalCount };
  }, [columnFilters, dateRange, pageSize, selectedPreset, sort, toast]);

  useEffect(() => {
    setPage(1);
  }, [columnFilters, groupBy, sort, dateRange, selectedPreset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData();
  };
  
  const activeFilters = Object.entries(columnFilters).filter(([, value]) => !!value);
  
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

  const handlePresetClick = (key: string) => {
    setSelectedPreset(key);
    const now = new Date();
    switch (key) {
        case 'none':
            setDateRange(undefined);
            break;
        case '1h':
            setDateRange({ from: subHours(now, 1), to: now });
            break;
        case '4h':
            setDateRange({ from: subHours(now, 4), to: now });
            break;
        case '8h':
            setDateRange({ from: subHours(now, 8), to: now });
            break;
        case '1d':
            setDateRange({ from: subDays(now, 1), to: now });
            break;
        case '7d':
            setDateRange({ from: subDays(now, 6), to: now });
            break;
        case '15d':
            setDateRange({ from: subDays(now, 14), to: now });
            break;
        case '1m':
            setDateRange({ from: subMonths(now, 1), to: now });
            break;
    }
    setIsDatePopoverOpen(false);
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
      setDateRange(range);
      setSelectedPreset(null);
      if (range?.from && range.to) {
        setIsDatePopoverOpen(false);
      }
  };
  
  const displayDateText = () => {
    if (selectedPreset) {
      const preset = timePresets.find(p => p.key === selectedPreset);
      return preset?.label;
    }
    if (dateRange?.from) {
      if (dateRange.to) {
        return `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}`;
      }
      return format(dateRange.from, "LLL dd, y");
    }
    return "None";
  };
  
  const today = new Date();
  
  const month = dateRange?.from || subMonths(new Date(), 1);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-lg bg-primary text-primary-foreground border-b-4 border-accent">
        <div className="flex items-center gap-4">
          <Logo src={logoSrc} fallbackSrc={fallbackSrc} className="h-10 w-10" />
          <h1 className="text-3xl font-bold tracking-tight">AS Errors Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} disabled={isPending} variant="outline" className="bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20 text-primary-foreground">
            <RotateCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="date-range-trigger">Time Range</Label>
                  <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="date-range-trigger"
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange && "text-muted-foreground"
                        )}
                        disabled={isPending}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {displayDateText()}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row" align="start">
                      <div className="p-4 border-b sm:border-b-0 sm:border-r">
                        <div className="grid gap-2">
                            {timePresets.map((preset) => (
                                <Button
                                    key={preset.key}
                                    variant={selectedPreset === preset.key ? "default" : "ghost"}
                                    className="justify-start"
                                    onClick={() => handlePresetClick(preset.key)}
                                >
                                    {preset.label}
                                </Button>
                            ))}
                        </div>
                      </div>
                      <Calendar
                        initialFocus
                        mode="range"
                        month={month}
                        selected={dateRange}
                        onSelect={handleCalendarSelect}
                        numberOfMonths={2}
                        fromMonth={subMonths(today, 1)}
                        toMonth={today}
                        disabled={{ after: today }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="group-by-trigger">Group By</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between" disabled={isPending} id="group-by-trigger">
                          <span>{groupBy.length > 0 ? `Grouped by ${groupBy.length} column(s)` : 'None'}</span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Group by columns</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setGroupBy([])} disabled={groupBy.length === 0}>
                            Clear selection
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {allColumns
                            .filter(col => columnVisibility[col.id])
                            .map((option) => (
                             !['log_date_time', 'as_start_date_time'].includes(option.id) &&
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
                                    Clear
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
        fetchLogsForDrilldown={fetchLogsForDrilldown}
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
