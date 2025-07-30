
/**
 * @fileoverview
 * The main component for the Error Insights Dashboard.
 * This component manages the state for the entire dashboard, including data fetching,
 * filters (date range, grouping, column visibility), and layout of sub-components
 * like the error table and trend chart.
 */
"use client";

import { useState, useEffect, useCallback, useTransition, useMemo, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

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

const chartBreakdownOptions: { value: ChartBreakdownByOption; label: string }[] = [
    { value: 'repository_path', label: 'Model' },
    { value: 'host_name', label: 'Host' },
    { value: 'user_id', label: 'User' },
    { value: 'report_id_name', label: 'Report Name' },
    { value: 'log_message', label: 'Message' },
    { value: 'error_number', label: 'Error Code' },
    { value: 'port_number', label: 'Port' },
    { value: 'as_server_mode', label: 'Server Mode' },
    { value: 'as_server_config', label: 'Server Config' },
    { value: 'version_number', label: 'AS Version' },
];

const defaultBreakdownFields = chartBreakdownOptions.map(o => o.value);

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

  const [lastRefreshed, setLastRefreshed] = useState<{ local: string; utc: string, timezone: string } | null>(null);
  
  const [columnWidths, setColumnWidths] = useState<Record<keyof ErrorLog, number>>(
    allColumns.reduce((acc, col) => {
      acc[col.id] = col.id === 'log_message' ? 400 : col.id === 'log_date_time' ? 210 : 150;
      return acc;
    }, {} as Record<keyof ErrorLog, number>)
  );

  const [activeTab, setActiveTab] = useState('logs');

  const latestRequestIdRef = useRef<string | null>(null);

  const fetchData = useCallback((isRefresh = false) => {
    startTransition(async () => {
      const isPresetActive = selectedPreset && selectedPreset !== 'none';
      const isFullDateRange = dateRange?.from && dateRange.to;

      if (!isPresetActive && !isFullDateRange) {
        if (selectedPreset === 'none' && !dateRange?.from) {
          setLogs([]);
          setTotalLogs(0);
          setChartData([]);
          setGroupData([]);
          setLastRefreshed(null);
        }
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
      
      const requestId = `req_data_${new Date().getTime()}`;
      latestRequestIdRef.current = requestId;
      
      const requestBody: LogsApiRequest = {
        requestId,
        pagination: { page, pageSize },
        sort: sort.column && sort.direction ? sort : { column: 'log_date_time', direction: 'descending' },
        filters: columnFilters,
        groupBy,
      };
      
      const preset = timePresets.find(p => p.key === selectedPreset);
      if (preset?.interval) {
        requestBody.interval = preset.interval;
      } else if (dateRange?.from && dateRange?.to) {
        const from = dateRange.from;
        const to = dateRange.to;
        const utcFrom = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0));
        const utcTo = new Date(Date.UTC(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999));
        
        requestBody.dateRange = {
          from: utcFrom.toISOString(),
          to: utcTo.toISOString(),
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

        if (requestId === latestRequestIdRef.current) {
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
          setGroupData(data.groupData ? processGroupData(data.groupData) : []);

          if (data.dbTime && data.dbTimeUtc && data.dbTimezone) {
              setLastRefreshed({ local: data.dbTime, utc: data.dbTimeUtc, timezone: data.dbTimezone });
          }
        }
        
      } catch (error) {
        if (requestId === latestRequestIdRef.current) {
          console.error("Failed to fetch logs:", error);
          toast({
            variant: "destructive",
            title: "Failed to Fetch Data",
            description: error instanceof Error ? error.message : "An unknown error occurred.",
          });
          setLogs([]);
          setTotalLogs(0);
          setGroupData([]);
        }
      }
    });
  }, [page, pageSize, sort, columnFilters, groupBy, dateRange, selectedPreset, toast]);
  
  const fetchChartData = useCallback((isRefresh = false) => {
    startTransition(async () => {
      const isPresetActive = selectedPreset && selectedPreset !== 'none';
      const isFullDateRange = dateRange?.from && dateRange.to;

      if (!isPresetActive && !isFullDateRange) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) return;

      const getChartBucket = (): ChartBucket => {
          if (selectedPreset) {
              if (['1h', '4h', '8h', '1d'].includes(selectedPreset)) return 'hour';
          }
          if (dateRange?.from && dateRange?.to) {
              const diffInHours = (dateRange.to.getTime() - dateRange.from.getTime()) / 36e5;
              if (diffInHours <= 48) return 'hour';
          }
          return 'day';
      };
      
      const requestId = `req_chart_${new Date().getTime()}`;
      latestRequestIdRef.current = requestId;

      const requestBody: LogsApiRequest = {
        requestId,
        filters: columnFilters,
        chartBucket: getChartBucket(),
        chartBreakdownFields: defaultBreakdownFields,
        groupBy: [], // Send empty groupBy to get chart data without grouping logs
      };

      const preset = timePresets.find(p => p.key === selectedPreset);
      if (preset?.interval) {
        requestBody.interval = preset.interval;
      } else if (dateRange?.from && dateRange?.to) {
        const from = dateRange.from;
        const to = dateRange.to;
        const utcFrom = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0));
        const utcTo = new Date(Date.UTC(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999));
        requestBody.dateRange = {
          from: utcFrom.toISOString(),
          to: utcTo.toISOString(),
        };
      }

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
        
        const data: LogsApiResponse = await response.json();

        if (requestId === latestRequestIdRef.current) {
            setChartData(data.chartData || []);
            if (data.dbTime && data.dbTimeUtc && data.dbTimezone) {
                setLastRefreshed({ local: data.dbTime, utc: data.dbTimeUtc, timezone: data.dbTimezone });
            }
        }

      } catch (error) {
        if (requestId === latestRequestIdRef.current) {
            console.error("Failed to fetch chart data:", error);
            toast({
                variant: "destructive",
                title: "Failed to Fetch Chart Data",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
            setChartData([]);
        }
      }
    });
  }, [dateRange, selectedPreset, columnFilters, toast]);

  const fetchLogsForDrilldown = useCallback(async (drilldownFilters: Record<string, string>, page: number): Promise<{logs: ErrorLog[], totalCount: number}> => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
          toast({
              variant: "destructive",
              title: "API URL Not Configured",
              description: "Please set NEXT_PUBLIC_API_URL in your environment.",
          });
          return { logs: [], totalCount: 0 };
      }
      const requestId = `req_drilldown_${new Date().getTime()}`;

      const drilldownFiltersAsConditions: ColumnFilters = Object.entries(drilldownFilters).reduce((acc, [key, value]) => {
        acc[key as keyof ColumnFilters] = { operator: 'in', values: [value] };
        return acc;
      }, {} as ColumnFilters);

      const combinedFilters = { ...columnFilters, ...drilldownFiltersAsConditions };
      const requestBody: LogsApiRequest = {
          requestId,
          pagination: { page, pageSize },
          sort: sort.column && sort.direction ? sort : { column: 'log_date_time', direction: 'descending' },
          filters: combinedFilters,
          groupBy: [],
      };

      const preset = timePresets.find(p => p.key === selectedPreset);
      if (preset?.interval) {
        requestBody.interval = preset.interval;
      } else if (dateRange?.from && dateRange?.to) {
        const from = dateRange.from;
        const to = dateRange.to;
        const utcFrom = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0));
        const utcTo = new Date(Date.UTC(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999));
        requestBody.dateRange = {
          from: utcFrom.toISOString(),
          to: utcTo.toISOString(),
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

      const requestId = `req_export_${new Date().getTime()}`;
      const requestBody: LogsApiRequest = {
        requestId,
        pagination: { page: 1, pageSize: totalLogs }, // Fetch all logs
        sort: sort.column && sort.direction ? sort : { column: 'log_date_time', direction: 'descending' },
        filters: columnFilters,
        groupBy: [],
      };

      const preset = timePresets.find(p => p.key === selectedPreset);
      if (preset?.interval) {
        requestBody.interval = preset.interval;
      } else if (dateRange?.from && dateRange?.to) {
        const from = dateRange.from;
        const to = dateRange.to;
        const utcFrom = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0));
        const utcTo = new Date(Date.UTC(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999));
        requestBody.dateRange = {
          from: utcFrom.toISOString(),
          to: utcTo.toISOString(),
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

  // Reset page to 1 when filters change, but not on page change itself
  useEffect(() => {
    setPage(1);
  }, [columnFilters, groupBy, sort, dateRange, selectedPreset]);

  // Consolidated data fetching logic
  useEffect(() => {
    const isFilterChange = true; 

    if (activeTab === 'logs') {
      fetchData(isFilterChange);
    } else if (activeTab === 'chart') {
      fetchChartData(isFilterChange);
    }
  // This effect should run when filters change or when the active tab changes.
  // The fetch functions themselves are wrapped in useCallback to prevent
  // re-running unless their own dependencies change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeTab, fetchData, fetchChartData]);

  const handleRefresh = () => {
    if (activeTab === 'logs') {
      fetchData(true);
    } else if (activeTab === 'chart') {
      fetchChartData(true);
    }
  };
  
  const activeFilters = Object.entries(columnFilters).filter(([, value]) => value && value.values.length > 0);
  
  const handleVisibilityChange = (columnId: keyof ErrorLog, value: boolean) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnId]: !!value,
    }));
  };
  
  const handleDeselectAllColumns = () => {
    setColumnVisibility(
      Object.fromEntries(allColumns.map(col => [col.id, false]))
    );
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

  const today = new Date();
  const oneMonthAgo = subMonths(today, 1);
  const orderedViewOptionsColumns = useMemo(() => {
    return allColumns;
  }, []);

  const visibleGroupByOptions = useMemo(() => {
    const groupableIds = new Set(GroupByOptionsList.map(o => o.id));
    return chartBreakdownOptions
      .filter(opt => groupableIds.has(opt.value as GroupByOption))
      .map(opt => {
        const col = allColumns.find(c => c.id === opt.value);
        return col ? { ...col } : { id: opt.value as keyof ErrorLog, name: opt.label };
      });
  }, []);

  const getOperatorText = (op: 'in' | 'notIn' | 'and') => {
    switch (op) {
      case 'in': return 'IS ONE OF';
      case 'notIn': return 'IS NONE OF';
      case 'and': return 'MUST CONTAIN ALL';
    }
  };

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
                            Last refreshed at {lastRefreshed.local} {lastRefreshed.timezone}
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
                        defaultMonth={oneMonthAgo}
                        fromMonth={oneMonthAgo}
                        toMonth={today}
                        selected={dateRange}
                        onSelect={handleCalendarSelect}
                        numberOfMonths={2}
                        disabled={{ before: oneMonthAgo, after: today }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="group-by-trigger">Group By</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between" disabled={isPending || activeTab === 'chart'} id="group-by-trigger">
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
                        <Button variant="outline" className="w-full justify-between" disabled={isPending || activeTab === 'chart'} id="view-options-trigger">
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
                                {activeFilters.map(([key, condition]) => {
                                    if (!condition || condition.values.length === 0) return null;
                                    const column = allColumns.find(c => c.id === key);
                                    if (!column) return null;

                                    return condition.values.map((val, index) => (
                                      <Badge key={`${key}-${index}`} variant="secondary" className="pl-2 pr-1 py-1 text-sm font-normal">
                                          {index === 0 && <span className="font-semibold mr-1">{column.name} {getOperatorText(condition.operator)}:</span>}
                                          <span className="mr-1 truncate max-w-xs">{String(val)}</span>
                                          <button 
                                              className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 disabled:opacity-50"
                                              onClick={() => {
                                                  const newValues = condition.values.filter(v => v !== val);
                                                  if (newValues.length > 0) {
                                                      setColumnFilters(prev => ({
                                                          ...prev,
                                                          [key]: { ...condition, values: newValues }
                                                      }));
                                                  } else {
                                                      setColumnFilters(prev => {
                                                          const newFilters = { ...prev };
                                                          delete newFilters[key as keyof ColumnFilters];
                                                          return newFilters;
                                                      });
                                                  }
                                              }}
                                              disabled={isPending}
                                          >
                                              <span className="sr-only">Remove {column.name} filter for {val}</span>
                                              <X className="h-3 w-3" />
                                          </button>
                                      </Badge>
                                    ));
                                })}
                            </div>
                        </div>
                    )}
                    {groupBy.length > 0 && activeTab === 'logs' && (
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
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="chart">Trend</TabsTrigger>
          </TabsList>
          <TabsContent value="logs" className="mt-4">
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
          </TabsContent>
          <TabsContent value="chart" className="mt-4">
              <ErrorTrendChart 
                data={chartData} 
                isLoading={isPending}
                breakdownBy={chartBreakdownBy}
                setBreakdownBy={setChartBreakdownBy}
                breakdownOptions={chartBreakdownOptions}
              />
          </TabsContent>
      </Tabs>
    </div>
  );
}
