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
import { type ErrorLog, type SortDescriptor, type ColumnFilters, type GroupByOption, type ErrorTrendDataPoint, type ApiErrorLog, type ChartBreakdownByOption, type GroupDataPoint, type LogsApiResponse, type LogsApiRequest, type ApiGroupDataPoint, type ChartBucket, GroupByOptionsList } from "@/types";
import { Button } from "@/components/ui/button";
import { ErrorTable } from "@/components/error-table";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCw, ChevronDown, X, Calendar as CalendarIcon, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ErrorTrendChart } from "./error-trend-chart";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import Logo from './logo';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

const allColumns: { id: keyof ErrorLog; name: string }[] = [
    { id: 'log_date_time', name: 'Timestamp' },
    { id: 'repository_path', name: 'Model' },
    { id: 'host_name', name: 'Host' },
    { id: 'user_id', name: 'User' },
    { id: 'report_id_name', name: 'Report Name' },
    { id: 'log_message', name: 'Message' },
    { id: 'error_number', name: 'Error Code' },
    { id: 'port_number', name: 'Port' },
    { id: 'as_server_mode', name: 'Server Mode' },
    { id: 'as_start_date_time', name: 'Server Start Time' },
    { id: 'as_server_config', name: 'Server Config' },
    { id: 'version_number', name: 'AS Version' },
    { id: 'xql_query_id', name: 'Query ID' },
];

const defaultVisibleColumns: (keyof ErrorLog)[] = [
  'log_date_time', 'repository_path', 'host_name', 'user_id', 'report_id_name', 'log_message'
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

const breakDownableColumns: (keyof ErrorLog)[] = GroupByOptionsList.map(o => o.id).filter(id => id !== 'log_message');

export default function ErrorDashboard({ logoSrc = "/circana-logo.svg", fallbackSrc = "/favicon.ico" }: { logoSrc?: string; fallbackSrc?: string } = {}) {
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
  
  const [columnVisibility, setColumnVisibility] = useState<Partial<Record<keyof ErrorLog, boolean>>>(
    Object.fromEntries(
      allColumns.map(col => [col.id, defaultVisibleColumns.includes(col.id)])
    )
  );
  
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [chartBreakdownBy, setChartBreakdownBy] = useState<ChartBreakdownByOption>('repository_path');
  
  const { toast } = useToast();

  const [lastRefreshed, setLastRefreshed] = useState<{ local: string; utc: string } | null>(null);
  
  const [columnWidths, setColumnWidths] = useState<Record<keyof ErrorLog, number>>(
    allColumns.reduce((acc, col) => {
      acc[col.id] = col.id === 'log_message' ? 400 : col.id === 'log_date_time' ? 210 : 150;
      return acc;
    }, {} as Record<keyof ErrorLog, number>)
  );

  const visibleBreakdownOptions = useMemo(() => {
    return allColumns
      .filter(col => columnVisibility[col.id] && breakDownableColumns.includes(col.id as GroupByOption))
      .map(col => ({ value: col.id as ChartBreakdownByOption, label: col.name }));
  }, [columnVisibility]);

  const visibleGroupByOptions = useMemo(() => {
    const groupableIds = new Set(GroupByOptionsList.map(o => o.id));
    return allColumns.filter(col => columnVisibility[col.id] && groupableIds.has(col.id as GroupByOption));
  }, [columnVisibility]);

  useEffect(() => {
    const firstOption = visibleBreakdownOptions[0]?.value || 'repository_path';
    if (!visibleBreakdownOptions.some(opt => opt.value === chartBreakdownBy)) {
      setChartBreakdownBy(firstOption);
    }
  }, [visibleBreakdownOptions, chartBreakdownBy]);

  const getPresetDisplay = (preset: (typeof timePresets)[number]) => {
    if (!preset.interval || ['none', '1h', '4h', '8h'].includes(preset.key)) {
      return preset.label;
    }

    const now = new Date();
    let fromDate: Date;

    switch (preset.key) {
      case '1d':
        fromDate = subDays(now, 1);
        break;
      case '7d':
        fromDate = subDays(now, 6);
        break;
      case '15d':
        fromDate = subDays(now, 14);
        break;
      case '1m':
        fromDate = subMonths(now, 1);
        break;
      default:
        return preset.label;
    }
    
    return `${preset.label} (${format(fromDate, 'MMM d')} - ${format(now, 'MMM d')})`;
  };
  
  const fetchData = useCallback(() => {
    startTransition(async () => {
      if (selectedPreset === 'none' && !dateRange?.from) {
        setLogs([]);
        setTotalLogs(0);
        setChartData([]);
        setGroupData([]);
        setLastRefreshed(null);
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

      const getChartBucket = (): ChartBucket => {
          if (selectedPreset) {
              if (['1h', '4h', '8h', '1d'].includes(selectedPreset)) {
                  return 'hour';
              }
          }
          if (dateRange?.from && dateRange?.to) {
              const diffInHours = (dateRange.to.getTime() - dateRange.from.getTime()) / 36e5;
              if (diffInHours <= 48) { // 2 days or less
                  return 'hour';
              }
          }
          return 'day'; // Default for longer ranges
      };
      
      const chartBucket = getChartBucket();
      const requestId = `req_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;
      const chartBreakdownFields = visibleBreakdownOptions.map(opt => opt.value);
      
      const requestBody: LogsApiRequest = {
        requestId,
        pagination: { page, pageSize },
        sort: sort.column && sort.direction ? sort : { column: 'log_date_time', direction: 'descending' },
        filters: columnFilters,
        groupBy,
        chartBucket,
        chartBreakdownFields,
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
            return logs.map((log, index) => ({
                ...log,
                id: `log-${log.log_date_time}-${index}`,
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
        if (data.dbTime && data.dbTimeUtc) {
            setLastRefreshed({ local: data.dbTime, utc: data.dbTimeUtc });
        }
        
        const firstOption = visibleBreakdownOptions[0]?.value;
        if (firstOption) {
            setChartBreakdownBy(firstOption);
        }

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
  }, [page, pageSize, sort, columnFilters, groupBy, dateRange, selectedPreset, toast, visibleBreakdownOptions]);
  
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

      const requestBody: Omit<LogsApiRequest, 'groupBy' | 'chartBucket' | 'chartBreakdownFields'> & { groupBy: [] } = {
          requestId,
          pagination: { page, pageSize },
          sort: sort.column && sort.direction ? sort : { column: 'log_date_time', direction: 'descending' },
          filters: { ...columnFilters, ...drilldownFilters },
          groupBy: [],
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
              id: `log-drilldown-${log.log_date_time}-${index}`,
          }));
      };
      return { logs: processLogs(data.logs), totalCount: data.totalCount };
  }, [columnFilters, dateRange, pageSize, selectedPreset, sort, toast]);

  const handleExport = useCallback(async () => {
    if (groupBy.length > 0) {
      toast({
        variant: "destructive",
        title: "Export Not Available",
        description: "Cannot export when data is grouped. Please clear grouping first.",
      });
      return;
    }

    if (totalLogs === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no logs matching the current filters.",
      });
      return;
    }

    setIsExporting(true);
    try {
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
      const requestBody: Omit<LogsApiRequest, 'groupBy' | 'chartBucket' | 'pagination' | 'chartBreakdownFields'> & { groupBy: [], pagination: {page: number, pageSize: number} } = {
        requestId,
        pagination: { page: 1, pageSize: totalLogs }, // Fetch all logs
        sort: sort.column && sort.direction ? sort : { column: 'log_date_time', direction: 'descending' },
        filters: columnFilters,
        groupBy: [],
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

      const visibleColumnDefs = allColumns.filter(c => columnVisibility[c.id]);
      const headers = visibleColumnDefs.map(c => c.name);
      const csvRows = [headers.join(',')];
      const logsToExport: ApiErrorLog[] = data.logs;

      logsToExport.forEach(log => {
        const row = visibleColumnDefs.map(colDef => {
          const colId = colDef.id;
          let value = log[colId as keyof ApiErrorLog];

          if (colId === 'repository_path' && typeof value === 'string') {
            const lastSlashIndex = value.lastIndexOf('/');
            value = lastSlashIndex !== -1 ? value.substring(lastSlashIndex + 1) : value;
          }
          
          let stringValue = String(value ?? '');

          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            stringValue = `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });
        csvRows.push(row.join(','));
      });

      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `as_error_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `${logsToExport.length} rows have been exported.`,
      });

    } catch (error) {
      console.error("Failed to export logs:", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
      setIsExporting(false);
    }
  }, [totalLogs, sort, columnFilters, groupBy, dateRange, selectedPreset, toast, columnVisibility]);

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
    const preset = timePresets.find(p => p.key === selectedPreset);
    if (preset) {
        return getPresetDisplay(preset);
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
  const oneMonthAgo = subMonths(today, 1);
  const orderedViewOptionsColumns = useMemo(() => {
    return allColumns;
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white border-b border-primary shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Logo src="/circana-logo.svg" fallbackSrc="/favicon.ico" className="h-7 w-7" />
          <span className="font-semibold text-base truncate">AnalyticServer Errors Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          {lastRefreshed && (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="text-xs text-white/80 hidden sm:block">
                            Last refreshed at {lastRefreshed.local}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>{lastRefreshed.utc} (UTC)</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
          )}
          <Button onClick={handleRefresh} disabled={isPending} variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 text-white px-2 py-1 h-8 text-sm">
            <RotateCw className={`mr-1 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExport} disabled={isPending || isExporting || groupBy.length > 0} variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 text-white px-2 py-1 h-8 text-sm">
            <Download className={`mr-1 h-4 w-4 ${isExporting ? 'animate-spin' : ''}`} />
            Export CSV
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
                                    {getPresetDisplay(preset)}
                                </Button>
                            ))}
                        </div>
                      </div>
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from || oneMonthAgo}
                        fromMonth={oneMonthAgo}
                        toMonth={today}
                        selected={dateRange}
                        onSelect={handleCalendarSelect}
                        numberOfMonths={2}
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
                          {visibleGroupByOptions.length > 0 ? (
                            visibleGroupByOptions.map((option) => (
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
                            ))
                           ) : (
                            <DropdownMenuItem disabled>No groupable columns visible</DropdownMenuItem>
                           )}
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
                          {orderedViewOptionsColumns.map((column) => (
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
          breakdownOptions={visibleBreakdownOptions}
        />
      </div>
    </div>
  );
}
