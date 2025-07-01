/**
 * @fileoverview
 * A component that renders error logs in a sortable, filterable, and paginated table.
 * It supports two display modes: a flat table view and a grouped view where logs
 * are collapsible under a common key (e.g., hostname or error code).
 */
"use client";

import React from "react";
import { type ErrorLog, type SortDescriptor, type ColumnFilters, type GroupByOption, type GroupDataPoint } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTablePagination } from "./data-table-pagination";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { cn } from "@/lib/utils";

interface ErrorTableProps {
  logs: ErrorLog[];
  isLoading: boolean;
  sortDescriptor: SortDescriptor;
  setSortDescriptor: (descriptor: SortDescriptor) => void;
  page: number;
  pageSize: number;
  totalLogs: number;
  setPage: (page: number) => void;
  groupBy: GroupByOption;
  groupData: GroupDataPoint[] | null;
  onGroupSelect: (groupKey: string) => void;
  columnFilters: ColumnFilters;
  setColumnFilters: (filters: React.SetStateAction<ColumnFilters>) => void;
  columnVisibility: Partial<Record<keyof ErrorLog, boolean>>;
  messageDisplayMode: 'truncate' | 'expand';
}

const columnConfig: {
  id: keyof ErrorLog;
  name: string;
  isFilterable: boolean;
  cellClassName?: string;
}[] = [
    { id: 'log_date_time', name: 'Timestamp', isFilterable: false, cellClassName: "font-mono text-xs" },
    { id: 'host_name', name: 'Host', isFilterable: true, cellClassName: "font-mono text-xs" },
    { id: 'repository_path', name: 'Model Name', isFilterable: true },
    { id: 'port_number', name: 'Port', isFilterable: true },
    { id: 'version_number', name: 'AS Version', isFilterable: true },
    { id: 'as_server_mode', name: 'Server Mode', isFilterable: true },
    { id: 'as_start_date_time', name: 'Server Start Time', isFilterable: false, cellClassName: "font-mono text-xs" },
    { id: 'as_server_config', name: 'Server Config', isFilterable: true },
    { id: 'user_id', name: 'User', isFilterable: true },
    { id: 'report_id_name', name: 'Report Name', isFilterable: true },
    { id: 'error_number', name: 'Error Code', isFilterable: true },
    { id: 'xql_query_id', name: 'Query ID', isFilterable: true, cellClassName: "font-mono text-xs" },
    { id: 'log_message', name: 'Message', isFilterable: true, cellClassName: "max-w-lg" },
];

const getFriendlyGroupName = (groupByValue: GroupByOption) => {
    switch (groupByValue) {
      case 'host_name': return 'Host';
      case 'repository_path': return 'Model Name';
      case 'error_number': return 'Error Code';
      case 'user_id': return 'User';
      case 'version_number': return 'AS Version';
      default: return 'Group';
    }
};

export function ErrorTable({
  logs,
  isLoading,
  sortDescriptor,
  setSortDescriptor,
  page,
  pageSize,
  totalLogs,
  setPage,
  groupBy,
  groupData,
  onGroupSelect,
  columnFilters,
  setColumnFilters,
  columnVisibility,
  messageDisplayMode,
}: ErrorTableProps) {
    
  const [expandedRowKey, setExpandedRowKey] = React.useState<string | null>(null);
  const visibleColumns = React.useMemo(() => columnConfig.filter(c => columnVisibility[c.id]), [columnVisibility]);
  const visibleColumnCount = visibleColumns.length;

  const renderCellContent = (log: ErrorLog, columnId: keyof ErrorLog) => {
    const value = log[columnId];
    
    // For these specific columns, if the value is empty, show a dash.
    if ((columnId === 'report_id_name' || columnId === 'log_message') && !value) {
        return <span className="text-muted-foreground">—</span>;
    }
    
    // For all other columns, if null/undefined, return an empty string for a clean table.
    if (value === null || value === undefined) return "";
    
    switch (columnId) {
        case 'log_date_time':
        case 'as_start_date_time':
            if (value instanceof Date) {
              // Format Date object to 'YYYY-MM-DD HH:MM:SS' in UTC
              return value.toISOString().slice(0, 19).replace('T', ' ');
            }
            return String(value);
        case 'repository_path':
            const path = String(value);
            const lastSlashIndex = path.lastIndexOf('/');
            if (lastSlashIndex !== -1) {
                return path.substring(lastSlashIndex + 1);
            }
            return path;
        case 'error_number':
            return (
                <Badge variant={(value as number) >= 500 ? "destructive" : "secondary"}>
                    {value as number}
                </Badge>
            );
        case 'report_id_name':
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span>{String(value)}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="max-w-md">{String(value)}</p>
                    </TooltipContent>
                </Tooltip>
            );
        case 'log_message':
             if (messageDisplayMode === 'truncate') {
                return (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>{String(value)}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="max-w-md">{String(value)}</p>
                        </TooltipContent>
                    </Tooltip>
                );
            }
            return String(value);
        default:
            return String(value);
    }
  }

  const renderSkeleton = () => (
    Array.from({ length: 10 }).map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        {visibleColumns.map(c => (
           <TableCell key={c.id}>
             <Skeleton className="h-6 w-full" />
           </TableCell>
        ))}
      </TableRow>
    ))
  );

  if (groupBy !== 'none') {
    const friendlyGroupName = getFriendlyGroupName(groupBy);
    
    if (isLoading && !groupData) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Error Groups by {friendlyGroupName}</CardTitle>
                    <CardDescription>
                        Loading groups...
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border p-4 space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!groupData || groupData.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Error Groups by {friendlyGroupName}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border h-24 flex items-center justify-center">
                        No groups found.
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Groups by {friendlyGroupName}</CardTitle>
          <CardDescription>
            Showing top {groupData.length} groups. Click a row to filter logs.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{friendlyGroupName}</TableHead>
                    <TableHead className="text-right">Error Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && Array.from({length: 5}).map((_, i) => <TableRow key={i}><TableCell colSpan={2}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)}
                  {!isLoading && groupData.map((item) => (
                    <TableRow 
                      key={item.key} 
                      className="cursor-pointer" 
                      onClick={() => onGroupSelect(item.key)}
                    >
                      <TableCell className="font-medium">{item.key}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Logs</CardTitle>
        <CardDescription>
          Showing {logs.length} of {totalLogs.toLocaleString()} errors.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  {columnConfig.map(column => (
                      columnVisibility[column.id] && (
                        <DataTableColumnHeader 
                          key={column.id}
                          column={column.id} 
                          title={column.name} 
                          sortDescriptor={sortDescriptor} 
                          setSortDescriptor={setSortDescriptor} 
                          columnFilters={column.isFilterable ? columnFilters : undefined} 
                          setColumnFilters={column.isFilterable ? setColumnFilters : undefined}
                          isPending={isLoading}
                        />
                      )
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? renderSkeleton() : logs.length > 0 ? (
                  logs.map((log, index) => {
                    const rowKey = `${log.log_date_time?.toISOString()}-${index}`;
                    const isExpanded = expandedRowKey === rowKey;
                    
                    return (
                        <React.Fragment key={rowKey}>
                          <TableRow
                            onClick={() => {
                                if (messageDisplayMode === 'expand') {
                                    setExpandedRowKey(isExpanded ? null : rowKey);
                                }
                            }}
                            className={cn(messageDisplayMode === 'expand' && "cursor-pointer")}
                            data-state={isExpanded && messageDisplayMode === 'expand' ? 'selected' : ''}
                          >
                            {visibleColumns.map(column => (
                              <TableCell key={column.id} className={cn(column.cellClassName, column.id === 'log_message' && messageDisplayMode === 'truncate' && 'truncate')}>
                                {renderCellContent(log, column.id)}
                              </TableCell>
                            ))}
                          </TableRow>
                          {isExpanded && messageDisplayMode === 'expand' && (
                            <TableRow>
                                <TableCell colSpan={visibleColumnCount} className="p-2 bg-muted/50">
                                    <div className="p-4 bg-background rounded-md">
                                        <h4 className="font-bold mb-2">Full Log Message:</h4>
                                        <pre className="text-sm whitespace-pre-wrap font-mono">{log.log_message}</pre>
                                    </div>
                                </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={visibleColumnCount || 1} className="h-24 text-center">
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      </CardContent>
      <CardFooter>
        <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={totalLogs}
            setPage={setPage}
            isPending={isLoading}
        />
      </CardFooter>
    </Card>
  );
}
