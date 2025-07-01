/**
 * @fileoverview
 * A component that renders error logs in a sortable, filterable, and paginated table.
 * It supports two display modes: a flat table view and a grouped view where logs
 * are collapsible under a common key (e.g., hostname or error code).
 */
"use client";

import React from "react";
import { type ErrorLog, type SortDescriptor, type ColumnFilters, type GroupByOption, type GroupDataPoint } from "@/types";
import { Copy, ChevronRight } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";

interface ErrorTableProps {
  logs: ErrorLog[];
  isLoading: boolean;
  sortDescriptor: SortDescriptor;
  setSortDescriptor: (descriptor: SortDescriptor) => void;
  page: number;
  pageSize: number;
  totalLogs: number;
  setPage: (page: number) => void;
  groupBy: GroupByOption[];
  groupData: GroupDataPoint[] | null;
  columnFilters: ColumnFilters;
  setColumnFilters: (filters: React.SetStateAction<ColumnFilters>) => void;
  columnVisibility: Partial<Record<keyof ErrorLog, boolean>>;
  allColumns: { id: keyof ErrorLog; name: string }[];
  columnWidths: Record<keyof ErrorLog, number>;
  setColumnWidths: React.Dispatch<React.SetStateAction<Record<keyof ErrorLog, number>>>;
}

const columnConfig: {
  id: keyof ErrorLog;
  name: string;
  isFilterable: boolean;
  cellClassName?: string;
}[] = [
    { id: 'log_date_time', name: 'Timestamp', isFilterable: false, cellClassName: "font-mono text-xs" },
    { id: 'host_name', name: 'Host', isFilterable: true, cellClassName: "max-w-40" },
    { id: 'repository_path', name: 'Model Name', isFilterable: true, cellClassName: "max-w-40" },
    { id: 'port_number', name: 'Port', isFilterable: true },
    { id: 'version_number', name: 'AS Version', isFilterable: true },
    { id: 'as_server_mode', name: 'Server Mode', isFilterable: true },
    { id: 'as_start_date_time', name: 'Server Start Time', isFilterable: false, cellClassName: "font-mono text-xs" },
    { id: 'as_server_config', name: 'Server Config', isFilterable: true, cellClassName: "max-w-32" },
    { id: 'user_id', name: 'User', isFilterable: true, cellClassName: "max-w-32" },
    { id: 'report_id_name', name: 'Report Name', isFilterable: true, cellClassName: "max-w-48" },
    { id: 'error_number', name: 'Error Code', isFilterable: true },
    { id: 'xql_query_id', name: 'Query ID', isFilterable: true, cellClassName: "font-mono text-xs max-w-32" },
    { id: 'log_message', name: 'Message', isFilterable: true, cellClassName: "max-w-lg" },
];

const GroupedRow = ({ item, level, allColumns }: { item: GroupDataPoint; level: number; allColumns: { id: keyof ErrorLog; name: string }[] }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const hasSubgroups = item.subgroups && item.subgroups.length > 0;

    return (
        <React.Fragment>
            <TableRow onClick={() => hasSubgroups && setIsExpanded(!isExpanded)} className={cn(hasSubgroups && "cursor-pointer hover:bg-muted/50")}>
                <TableCell style={{ paddingLeft: `${1 + level * 1.5}rem` }}>
                    <div className="flex items-center gap-2">
                       {hasSubgroups ? (
                            <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                       ) : (
                            <span className="w-4 h-4" /> // for alignment
                       )}
                       <span className="font-medium">{item.key}</span>
                    </div>
                </TableCell>
                <TableCell className="text-right">{item.count.toLocaleString()}</TableCell>
            </TableRow>
            {isExpanded && hasSubgroups && (
                item.subgroups.map(subItem => (
                    <GroupedRow key={`${level}-${subItem.key}`} item={subItem} level={level + 1} allColumns={allColumns} />
                ))
            )}
        </React.Fragment>
    );
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
  columnFilters,
  setColumnFilters,
  columnVisibility,
  allColumns,
  columnWidths,
  setColumnWidths,
}: ErrorTableProps) {
  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);
  const visibleColumns = React.useMemo(() => columnConfig.filter(c => columnVisibility[c.id]), [columnVisibility]);
  const visibleColumnCount = visibleColumns.length;
  const { toast } = useToast();

  const [resizingColumn, setResizingColumn] = React.useState<{ id: keyof ErrorLog; startX: number; startWidth: number; } | null>(null);

  const handleResizeStart = React.useCallback((columnId: keyof ErrorLog, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizingColumn({
          id: columnId,
          startX: e.clientX,
          startWidth: columnWidths[columnId] || 150,
      });
  }, [columnWidths]);

  const handleResize = React.useCallback((e: MouseEvent) => {
      if (!resizingColumn) return;
      const deltaX = e.clientX - resizingColumn.startX;
      const newWidth = Math.max(resizingColumn.startWidth + deltaX, 80); // min width 80px

      setColumnWidths(prev => ({
          ...prev,
          [resizingColumn.id]: newWidth,
      }));
  }, [resizingColumn, setColumnWidths]);

  const handleResizeEnd = React.useCallback(() => {
      setResizingColumn(null);
  }, []);

  React.useEffect(() => {
      if (resizingColumn) {
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
          document.addEventListener('mousemove', handleResize);
          document.addEventListener('mouseup', handleResizeEnd, { once: true });
      }
      return () => {
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          document.removeEventListener('mousemove', handleResize);
          document.removeEventListener('mouseup', handleResizeEnd);
      };
  }, [resizingColumn, handleResize, handleResizeEnd]);

  const handleCopy = async (textToCopy: string, fieldName: string) => {
    if (!textToCopy || textToCopy === '—') {
      toast({
        title: "Nothing to copy",
        description: `The ${fieldName} field is empty.`,
      });
      return;
    }

    let success = false;

    try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(textToCopy);
          success = true;
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            textArea.style.position = "fixed";
            textArea.style.top = "-9999px";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            success = document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    } catch (err) {
        console.error('Copy to clipboard failed:', err);
        success = false;
    }
    
    if (success) {
      toast({
        title: "Copied to clipboard",
        description: `The ${fieldName} has been copied.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Could not copy to clipboard. Your browser may not support this feature or is not in a secure context.",
      });
    }
  };

  const renderCellContent = (log: ErrorLog, columnId: keyof ErrorLog) => {
    const value = log[columnId];
    
    if (value === null || value === undefined || value === '') {
        return <span className="text-muted-foreground">—</span>;
    }
    
    switch (columnId) {
        case 'log_date_time':
        case 'as_start_date_time':
            if (value instanceof Date) {
              return value.toISOString().slice(0, 19).replace('T', ' ');
            }
            return String(value);
        case 'repository_path':
            const path = String(value);
            const lastSlashIndex = path.lastIndexOf('/');
            return lastSlashIndex !== -1 ? path.substring(lastSlashIndex + 1) : path;
        case 'error_number':
            return (
                <Badge variant={(value as number) >= 500 ? "destructive" : "secondary"}>
                    {value as number}
                </Badge>
            );
        default:
            return String(value);
    }
  };

  const renderExpandedDetail = (log: ErrorLog, columnId: keyof ErrorLog) => {
    const value = log[columnId];
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    switch (columnId) {
        case 'log_date_time':
        case 'as_start_date_time':
            if (value instanceof Date) {
              return value.toISOString();
            }
            return String(value);
        case 'repository_path': {
            const path = String(value);
            return path;
        }
        default:
            return String(value);
    }
  };

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

  if (groupBy.length > 0) {
    const friendlyGroupNames = groupBy.map(g => allColumns.find(c => c.id === g)?.name || g).join(', ');
    
    const renderGroupedSkeleton = () => (
        Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={`grouped-skeleton-${i}`}>
                <TableCell><Skeleton className="h-8 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-8 w-1/4 ml-auto" /></TableCell>
            </TableRow>
        ))
    );

    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Groups by {friendlyGroupNames}</CardTitle>
          <CardDescription>
            {isLoading ? 'Loading groups...' : (groupData && groupData.length > 0 ? 'Showing top groups. Click a row to expand.' : 'No groups to display.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Error Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? renderGroupedSkeleton() : groupData && groupData.length > 0 ? (
                    groupData.map((item) => (
                      <GroupedRow key={item.key} item={item} level={0} allColumns={allColumns} />
                    ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center">
                            No groups found for the selected criteria.
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>
    );
  }


  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>Error Logs</CardTitle>
          <CardDescription>
            Showing {logs.length > 0 ? `1-${logs.length}` : 0} of {totalLogs.toLocaleString()} errors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                  {columnConfig.map(column => (
                    columnVisibility[column.id] && (
                        <col key={column.id} style={{ width: columnWidths[column.id] ? `${columnWidths[column.id]}px` : undefined }} />
                    )
                  ))}
              </colgroup>
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
                          onResizeStart={handleResizeStart}
                        />
                      )
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? renderSkeleton() : logs.length > 0 ? (
                  logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                          <TableRow
                            data-state={expandedRowId === log.id && "selected"}
                            className="cursor-pointer"
                            onClick={() => setExpandedRowId(prev => (prev === log.id ? null : log.id))}
                          >
                            {visibleColumns.map(column => (
                              <TableCell key={column.id} className={cn("truncate", column.cellClassName)}>
                                {renderCellContent(log, column.id)}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Click row to view all details.</p>
                        </TooltipContent>
                      </Tooltip>
                      {expandedRowId === log.id && (
                        <TableRow>
                          <TableCell colSpan={visibleColumnCount}>
                            <div className="p-4 bg-muted/50 rounded-md space-y-3">
                              <h4 className="text-sm font-semibold">Full Log Details</h4>
                              <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-xs">
                                {allColumns
                                .filter(col => columnVisibility[col.id])
                                .map(col => {
                                  const isCopyable = col.id === 'log_message' || col.id === 'report_id_name';
                                  const detailValue = renderExpandedDetail(log, col.id);
                                  return (
                                    <div 
                                      key={col.id}
                                      className={cn(
                                        "flex flex-col gap-1", 
                                        col.id === 'log_message' && 'md:col-span-2 lg:col-span-3'
                                      )}
                                    >
                                      <dt className="font-medium text-muted-foreground">{col.name}</dt>
                                      <dd className="flex items-start justify-between gap-2 font-mono">
                                        <span className="whitespace-pre-wrap break-all pt-1">
                                          {detailValue}
                                        </span>
                                        {isCopyable && (
                                           <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-7 w-7 shrink-0"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCopy(String(detailValue), col.name);
                                                  }}
                                                >
                                                  <Copy className="h-4 w-4" />
                                                  <span className="sr-only">Copy {col.name}</span>
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Copy {col.name}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                        )}
                                      </dd>
                                    </div>
                                  );
                                })}
                              </dl>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
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
    </TooltipProvider>
  );
}
