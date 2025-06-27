/**
 * @fileoverview
 * A component that renders error logs in a sortable, filterable, and paginated table.
 * It supports two display modes: a flat table view and a grouped view where logs
 * are collapsible under a common key (e.g., hostname or error code).
 */
"use client";

import React from "react";
import { type ErrorLog, type SortDescriptor, type GroupedLogs, type ColumnFilters, type GroupByOption } from "@/types";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
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
  groupedLogs: GroupedLogs | null;
  columnFilters: ColumnFilters;
  setColumnFilters: (filters: React.SetStateAction<ColumnFilters>) => void;
  columnVisibility: Partial<Record<keyof ErrorLog, boolean>>;
}

const columnConfig: {
  id: keyof ErrorLog;
  name: string;
  isFilterable: boolean;
  cellClassName?: string;
  truncate?: boolean;
}[] = [
    { id: 'log_date_time', name: 'Timestamp', isFilterable: false, cellClassName: "font-mono text-xs" },
    { id: 'host_name', name: 'Host', isFilterable: true, cellClassName: "font-mono text-xs" },
    { id: 'repository_path', name: 'Repository', isFilterable: true },
    { id: 'port_number', name: 'Port', isFilterable: true },
    { id: 'version_number', name: 'Version', isFilterable: true },
    { id: 'as_server_mode', name: 'Server Mode', isFilterable: true },
    { id: 'as_start_date_time', name: 'Server Start Time', isFilterable: false, cellClassName: "font-mono text-xs" },
    { id: 'as_server_config', name: 'Server Config', isFilterable: true },
    { id: 'user_id', name: 'User', isFilterable: true },
    { id: 'report_id_name', name: 'Report Name', isFilterable: true },
    { id: 'error_number', name: 'Error Code', isFilterable: true },
    { id: 'xql_query_id', name: 'Query ID', isFilterable: true, cellClassName: "font-mono text-xs" },
    { id: 'log_message', name: 'Message', isFilterable: true, cellClassName: "max-w-[200px] sm:max-w-xs", truncate: true },
];

const getFriendlyGroupName = (groupByValue: GroupByOption) => {
    switch (groupByValue) {
      case 'host_name': return 'Host';
      case 'repository_path': return 'Repository';
      case 'error_number': return 'Error Code';
      case 'user_id': return 'User';
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
  groupedLogs,
  columnFilters,
  setColumnFilters,
  columnVisibility
}: ErrorTableProps) {
    
  const visibleColumns = React.useMemo(() => columnConfig.filter(c => columnVisibility[c.id]), [columnVisibility]);
  const visibleColumnCount = visibleColumns.length;

  const renderCellContent = (log: ErrorLog, columnId: keyof ErrorLog) => {
    const value = log[columnId];
    if (value === null || value === undefined) return "";
    
    switch (columnId) {
        case 'log_date_time':
        case 'as_start_date_time':
            if (value instanceof Date) {
              // Format Date object to 'YYYY-MM-DD HH:MM:SS' in UTC
              return value.toISOString().slice(0, 19).replace('T', ' ');
            }
            return String(value);
        case 'error_number':
            return (
                <Badge variant={(value as number) >= 500 ? "destructive" : "secondary"}>
                    {value as number}
                </Badge>
            );
        case 'log_message':
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
        default:
            return String(value);
    }
  }

  const renderSkeleton = () => (
    Array.from({ length: 10 }).map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        <TableCell colSpan={visibleColumnCount || 1}>
          <Skeleton className="h-8 w-full" />
        </TableCell>
      </TableRow>
    ))
  );

  if (groupBy !== 'none') {
    if (isLoading) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle>Error Logs by {getFriendlyGroupName(groupBy)}</CardTitle>
                  <CardDescription>
                      Grouping errors...
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
    if (!groupedLogs || Object.keys(groupedLogs).length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Error Logs by {getFriendlyGroupName(groupBy)}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border h-24 flex items-center justify-center">
                        No results found.
                    </div>
                </CardContent>
            </Card>
        )
    }
    
    const sortedGroupedLogs = Object.entries(groupedLogs).sort(([, a], [, b]) => b.count - a.count);

    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Logs by {getFriendlyGroupName(groupBy)}</CardTitle>
          <CardDescription>
            Showing {sortedGroupedLogs.length} error groups.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <Accordion type="single" collapsible className="w-full">
              {sortedGroupedLogs.map(([groupKey, groupData]) => (
                <AccordionItem value={groupKey} key={groupKey} className="border-b">
                  <AccordionTrigger className="hover:no-underline p-4">
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-4">
                        <span className="font-semibold truncate max-w-xs">{groupKey}</span>
                        <Badge variant="secondary">{groupData.count} {groupData.count > 1 ? 'errors' : 'error'}</Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="rounded-md border">
                      <Table>
                          <TableHeader>
                            <TableRow>
                              {visibleColumns.map((column) => (
                                <TableHead key={column.id} className={cn('p-2', column.cellClassName)}>
                                  {column.name}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                        <TableBody>
                          {groupData.logs.map(log => (
                            <TableRow 
                              key={log.id}
                              className="transition-colors"
                            >
                              {visibleColumns.map((column) => (
                                  <TableCell key={column.id} className={cn(column.cellClassName, column.truncate && 'truncate')}>
                                    {renderCellContent(log, column.id)}
                                  </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TooltipProvider>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Logs</CardTitle>
        <CardDescription>
          Showing {logs.length} of {totalLogs} errors.
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
                        />
                      )
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? renderSkeleton() : logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow 
                      key={log.id}
                    >
                      {visibleColumns.map(column => (
                        <TableCell key={column.id} className={cn(column.cellClassName, column.truncate && 'truncate')}>
                          {renderCellContent(log, column.id)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
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
