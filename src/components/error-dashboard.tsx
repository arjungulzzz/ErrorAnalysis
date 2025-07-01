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
import { Card, CardContent } from "@/components/ui/card";
import { RotateCw, ChevronDown, X } from "lucide-react";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ErrorTrendChart } from "./error-trend-chart";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { processLogsRequest } from "@/lib/mock-api";

interface DashboardViewState {
  columnFilters: ColumnFilters;
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

const nonGroupableColumns: Array<keyof ErrorLog> = ['log_date_time', 'as_start_date_time'];

export default function ErrorDashboard() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [chartData, setChartData] = useState<ErrorTrendDataPoint[]>([]);
  const [groupData, setGroupData] = useState<GroupDataPoint[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
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
    error_number: true,
    xql_query_id: false,
    log_message: true,
  });
  
  const [isPending, startTransition] = useTransition();
  const [chartBreakdownBy, setChartBreakdownBy] = useState<ChartBreakdownByOption>('host_name');
  
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
        sort,
        groupBy,
        columnVisibility,
        chartBreakdownBy,
        columnWidths
      };
      
      localStorage.setItem('error-dashboard-view-state', JSON.stringify(stateToSave));
  }, [
      columnFilters, 
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
        pagination: { page, pageSize },
        sort: sort.column && sort.direction ? sort : { column: 'log_date_time', direction: 'descending' },
        filters: columnFilters,
        groupBy,
        chartBreakdownBy,
      };

      try {
        let data: LogsApiResponse;

        if (apiUrl) {
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: response.statusText }));
              throw new Error(errorData.message || `API request failed with status ${response.status}`);
            }
            data = await response.json();
        } else {
            // Use mock service if no API URL is provided
            if (isClient) {
              data = processLogsRequest(requestBody);
            } else {
              // Return empty state for server-side render
              setLogs([]);
              setTotalLogs(0);
              setChartData([]);
              setGroupData([]);
              return;
            }
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
  }, [page, pageSize, sort, columnFilters, groupBy, chartBreakdownBy, toast, isClient]);
  
  useEffect(() => {
    // Reset page to 1 whenever filters, grouping, or date changes
    setPage(1);
  }, [columnFilters, groupBy, sort]);

  useEffect(() => {
    // Main fetch trigger
    if (isClient) { // Only fetch data on the client
      fetchData();
    }
  }, [fetchData, isClient]);

  
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
            <svg
              width="32"
              height="32"
              viewBox="0 0 190 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id="logo-gradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#6750A4" />
                  <stop offset="100%" stopColor="#EE6B6B" />
                </linearGradient>
                <mask id="logo-mask">
                  <g stroke="white" strokeWidth="10" fill="none">
                    <ellipse cx="45" cy="100" rx="40" ry="95" />
                    <ellipse cx="60" cy="100" rx="40" ry="95" />
                    <ellipse cx="75" cy="100" rx="40" ry="95" />
                    <ellipse cx="90" cy="100" rx="40" ry="95" />
                    <ellipse cx="105" cy="100" rx="40" ry="95" />
                    <ellipse cx="120" cy="100" rx="40" ry="95" />
                    <ellipse cx="135" cy="100" rx="40" ry="95" />
                  </g>
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width="190"
                height="200"
                fill="url(#logo-gradient)"
                mask="url(#logo-mask)"
              />
            </svg>
          </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 items-end">
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
