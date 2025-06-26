"use client";

import { useState, useEffect, useCallback, useTransition, useMemo } from "react";
import { type ErrorLog, type SortDescriptor, type GroupedLogs, type ColumnFilters, type GroupByOption, type ErrorTrendDataPoint } from "@/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorTable } from "@/components/error-table";
import { type DateRange } from "react-day-picker";
import { format, subDays, subMonths, addMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCw, ChevronDown, Calendar as CalendarIcon } from "lucide-react";
import { Label } from "./ui/label";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ErrorTrendChart } from "./error-trend-chart";

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

const TIME_PRESETS = [
    { value: 'none', label: 'None' },
    { value: '4h', label: 'Last 4 hours' },
    { value: '8h', label: 'Last 8 hours' },
    { value: '1d', label: 'Last 1 day' },
    { value: '7d', label: 'Last 7 days' },
    { value: '15d', label: 'Last 15 days' },
    { value: '1m', label: 'Last month' },
];

export default function ErrorDashboard() {
  const [allLogs, setAllLogs] = useState<ErrorLog[]>([]);
  const [chartData, setChartData] = useState<ErrorTrendDataPoint[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [timePreset, setTimePreset] = useState<string>('none');
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const fetchData = useCallback(() => {
    startTransition(async () => {
      // If no date range is selected, clear the data and don't fetch.
      if (!dateRange) {
        setAllLogs([]);
        setChartData([]);
        return;
      }

      try {
        const response = await fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ dateRange }),
        });

        if (!response.ok) {
          console.error("Failed to fetch logs:", response.statusText);
          setAllLogs([]);
          setChartData([]);
          return;
        }

        const logsResult: ErrorLog[] = await response.json();
        
        // Dates in JSON are strings, convert them back to Date objects for sorting
        const logsWithDates = logsResult.map(log => ({
          ...log,
          log_date_time: new Date(log.log_date_time),
          as_start_date_time: new Date(log.as_start_date_time),
        }));
        
        setAllLogs(logsWithDates);

        // Calculate chart data from the fetched logs
        const countsByDate: Record<string, { count: number; breakdown: Record<string, number> }> = {};
        
        if (dateRange.from && dateRange.to) {
          let current = new Date(dateRange.from);
          const to = new Date(dateRange.to);

          while (current <= to) {
              const dateStr = format(current, 'yyyy-MM-dd');
              countsByDate[dateStr] = { count: 0, breakdown: {} };
              current.setDate(current.getDate() + 1);
          }
        }

        logsWithDates.forEach(log => {
          const dateStr = format(new Date(log.log_date_time), 'yyyy-MM-dd');
          if (countsByDate[dateStr] !== undefined) {
              countsByDate[dateStr].count++;
              const host = log.host_name;
              countsByDate[dateStr].breakdown[host] = (countsByDate[dateStr].breakdown[host] || 0) + 1;
          }
        });

        const newChartData = Object.entries(countsByDate).map(([date, data]) => ({
          date,
          count: data.count,
          formattedDate: format(new Date(date), "MMM d"),
          breakdown: data.breakdown,
        }));

        newChartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        setChartData(newChartData);

      } catch (error) {
        console.error("Error fetching data:", error);
        setAllLogs([]);
        setChartData([]);
      }
    });
  }, [dateRange]);
  
  useEffect(() => {
    setPage(1);
  }, [columnFilters, groupBy, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { paginatedLogs, total, filteredAndSortedLogs } = useMemo(() => {
    let logs = [...allLogs];

    // Client-side filtering
    if (Object.values(columnFilters).some(v => v)) {
      logs = logs.filter(log => {
        return Object.entries(columnFilters).every(([key, value]) => {
          if (!value) return true;
          const logValue = log[key as keyof ErrorLog];
          return String(logValue).toLowerCase().includes(value.toLowerCase());
        });
      });
    }
    
    // Client-side sorting
    if (sort && sort.column && sort.direction) {
      logs.sort((a, b) => {
        const aValue = a[sort.column!];
        const bValue = b[sort.column!];
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        let comparison = 0;
        if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        }
        return sort.direction === 'descending' ? comparison * -1 : comparison;
      });
    }
    
    const totalCount = logs.length;
    const paginated = logs.slice((page - 1) * pageSize, page * pageSize);

    return { paginatedLogs: paginated, total: totalCount, filteredAndSortedLogs: logs };
  }, [allLogs, columnFilters, sort, page, pageSize]);

  const groupedData = useMemo((): GroupedLogs | null => {
    if (groupBy === 'none') return null;
    
    const groups: GroupedLogs = {};
    
    filteredAndSortedLogs.forEach(log => {
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
  }, [filteredAndSortedLogs, groupBy]);

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
      case "15d":
        fromDate = subDays(now, 15);
        break;
      case "1m":
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
                    <Label className="block text-sm font-medium mb-1">Time Range</Label>
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                    "w-[260px] justify-start text-left font-normal",
                                    !dateRange && "text-muted-foreground"
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
                                toMonth={new Date()}
                                disabled={(date: Date) => {
                                    const today = new Date();
                                    const oneMonthAgo = subMonths(today, 1);
                                
                                    if (date > today || date < oneMonthAgo) {
                                        return true;
                                    }
                                
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
                          All Columns <ChevronDown className="ml-auto h-4 w-4" />
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
        logs={paginatedLogs} 
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
      <div className="mt-6">
        <ErrorTrendChart data={chartData} isLoading={isPending} />
      </div>
    </div>
  );
}
