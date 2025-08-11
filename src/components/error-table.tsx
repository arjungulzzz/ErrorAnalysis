/**
 * @fileoverview
 * A component that renders error logs in a sortable, filterable, and paginated table.
 * It supports two display modes: a flat table view and a grouped view where logs
 * are collapsible under a common key (e.g., hostname or error code).
 */
"use client";

import React from "react";
import { type ErrorLog, type SortDescriptor, type ColumnFilters, type GroupByOption, type GroupDataPoint } from "@/types";
import { Copy, ChevronRight, Loader2, Check } from "lucide-react";
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

interface CopyableCellProps {
  value: any;
  as?: 'div' | 'span';
  className?: string;
  maxDisplayLength?: number;
  showCharacterCount?: boolean;
}

const CopyableCell = ({ 
  value, 
  as = "div", 
  className,
  maxDisplayLength = 100,
  showCharacterCount = true
}: CopyableCellProps) => {
  const [isCopied, setIsCopied] = React.useState(false);
  const Tag = as;

  const handleCopy = React.useCallback(async (textToCopy: string) => {
    if (!textToCopy || textToCopy === '—') return;

    let success = false;
    try {
      await navigator.clipboard.writeText(textToCopy);
      success = true;
    } catch (err) {
      // Fallback for older browsers or when clipboard API is not available
      try {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, textArea.value.length);
        document.execCommand('copy');
        document.body.removeChild(textArea);
        success = true;
      } catch (fallbackErr) {
        console.error("Copy to clipboard failed:", fallbackErr);
        success = false;
      }
    }
    
    if (success) {
      setIsCopied(true);
      // Reset after 2.5 seconds
      setTimeout(() => setIsCopied(false), 2500);
    }
  }, []);

  // Handle empty/null values
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground">—</span>;
  }
  
  const textValue = String(value);
  const isLongText = textValue.length > maxDisplayLength;
  const displayValue = React.isValidElement(value) ? value : textValue;

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Tag className={cn(
          "truncate cursor-pointer transition-colors hover:text-foreground/80", 
          as === "div" && "w-full", 
          className
        )}>
          {displayValue}
        </Tag>
      </TooltipTrigger>
      <TooltipContent
        className={cn(
          "max-w-sm bg-gradient-to-br from-popover to-popover/95 backdrop-blur-sm text-popover-foreground border",
          "shadow-lg animate-in fade-in-0 zoom-in-95 duration-200"
        )}
        side="bottom"
        align="start"
        sideOffset={6}
      >
        <div className="flex flex-col gap-2 p-2">
          {/* Text content with improved styling */}
          <div className="relative">
            <p className="font-mono text-xs whitespace-pre-wrap break-words leading-snug selection:bg-accent">
              {textValue}
            </p>
            
            {/* Subtle gradient overlay for very long text */}
            {textValue.length > 200 && (
              <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-popover/95 to-transparent pointer-events-none" />
            )}
          </div>
          
          {/* Enhanced copy button */}
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-6 px-2 gap-1.5 transition-all duration-200 ease-out font-medium text-xs",
              "focus:ring-1 focus:ring-ring focus:ring-offset-1",
              "active:scale-95",
              isCopied && [
                "bg-accent hover:bg-accent/80",
                "border-accent-foreground/20 text-accent-foreground"
              ]
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(textValue);
            }}
            disabled={isCopied}
          >
            <div className="flex items-center gap-1">
              {isCopied ? (
                <Check className="h-3 w-3 animate-in zoom-in-50 duration-200" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              <span className="font-medium">
                {isCopied ? "Copied!" : "Copy"}
              </span>
            </div>
          </Button>
        </div>
        
        {/* Optional: Character count for long text */}
        {showCharacterCount && textValue.length > 50 && (
          <div className="px-2 pb-1">
            <div className="text-xs text-muted-foreground font-mono">
              {textValue.length.toLocaleString()} chars
            </div>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
};


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
  fetchLogsForDrilldown: (drilldownFilters: Record<string, string>, page: number) => Promise<{logs: ErrorLog[], totalCount: number}>;
}

const columnConfig: {
  id: keyof ErrorLog;
  name: string;
  isFilterable: boolean;
  cellClassName?: string;
}[] = [
    { id: 'log_date_time', name: 'Timestamp', isFilterable: false, cellClassName: "font-mono text-xs" },
    { id: 'repository_path', name: 'Model', isFilterable: true, cellClassName: "max-w-40" },
    { id: 'host_name', name: 'Host', isFilterable: true, cellClassName: "max-w-40" },
    { id: 'user_id', name: 'User', isFilterable: true, cellClassName: "max-w-32" },
    { id: 'report_id_name', name: 'Report Name', isFilterable: true, cellClassName: "max-w-48" },
    { id: 'log_message', name: 'Message', isFilterable: true, cellClassName: "max-w-lg" },
    { id: 'port_number', name: 'Port', isFilterable: true },
    { id: 'as_server_mode', name: 'Server Mode', isFilterable: true },
    { id: 'as_start_date_time', name: 'Server Start Time', isFilterable: false, cellClassName: "font-mono text-xs" },
    { id: 'as_server_config', name: 'Server Config', isFilterable: true, cellClassName: "max-w-32" },
    { id: 'error_number', name: 'Error Code', isFilterable: true },
    { id: 'version_number', name: 'AS Version', isFilterable: true },
    { id: 'xql_query_id', name: 'Query ID', isFilterable: true, cellClassName: "font-mono text-xs max-w-32" },
];

const GroupedRow = ({
    item, 
    level,
    groupingKeys,
    parentPath,
    groupLogsData,
    onFetchLogs,
    visibleColumns,
    renderCellContent,
    pageSize
}: { 
    item: GroupDataPoint; 
    level: number;
    groupingKeys: GroupByOption[];
    parentPath: Record<string, string>;
    groupLogsData: Record<string, { logs: ErrorLog[]; total: number; page: number; isLoading: boolean }>;
    onFetchLogs: (path: Record<string, string>, page: number) => void;
    visibleColumns: { id: keyof ErrorLog; name: string }[];
    renderCellContent: (log: ErrorLog, columnId: keyof ErrorLog) => React.ReactNode;
    pageSize: number;
}) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);

    const hasSubgroups = item.subgroups && item.subgroups.length > 0;
    const isFinalLevel = level === groupingKeys.length - 1;
    const isExpandable = hasSubgroups || isFinalLevel;

    const currentPath = { ...parentPath, [groupingKeys[level]]: item.key };
    const groupKey = Object.values(currentPath).join(':');
    const logsData = groupLogsData[groupKey];
    
    const handleToggle = () => {
        if (!isExpandable) return;
        const newExpandedState = !isExpanded;
        setIsExpanded(newExpandedState);
        if (newExpandedState && isFinalLevel && !logsData) {
            onFetchLogs(currentPath, 1);
        }
    };
    
    const DrilldownSkeleton = () => (
      <div className="p-2">
        <Card className="shadow-none border-border/50">
          <CardContent className="p-0">
            <Table className="bg-background">
              <TableHeader>
                  <TableRow className="hover:bg-transparent">
                      <TableHead className="h-10 w-12 text-center">#</TableHead>
                      {visibleColumns.map(col => (
                          <TableHead key={col.id} className="h-10">
                              <Skeleton className="h-5 w-3/4" />
                          </TableHead>
                      ))}
                  </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`drilldown-skeleton-${i}`}>
                    <TableCell>
                      <Skeleton className="h-6 w-8 mx-auto" />
                    </TableCell>
                    {visibleColumns.map(c => (
                       <TableCell key={c.id}>
                         <Skeleton className="h-6 w-full" />
                       </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter>
            <DataTablePagination
              page={1}
              pageSize={pageSize}
              total={0}
              setPage={() => {}}
              isPending={true}
            />
          </CardFooter>
        </Card>
      </div>
    );

    return (
        <React.Fragment>
            <TableRow onClick={handleToggle} className={cn(isExpandable && "cursor-pointer hover:bg-muted/50")}>
                <TableCell style={{ paddingLeft: `${1 + level * 1.5}rem` }}>
                    <div className="flex items-center gap-2">
                       {isExpandable ? (
                            <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                       ) : (
                            <span className="w-4 h-4" />
                       )}
                       <span className="font-medium">{item.key}</span>
                    </div>
                </TableCell>
                <TableCell className="text-right">{item.count.toLocaleString()}</TableCell>
            </TableRow>
            {isExpanded && hasSubgroups && (
                item.subgroups.map((subItem, index) => (
                    <GroupedRow 
                      key={`${level}-${item.key}-${index}`} 
                      item={subItem} 
                      level={level + 1} 
                      groupingKeys={groupingKeys}
                      parentPath={currentPath}
                      groupLogsData={groupLogsData}
                      onFetchLogs={onFetchLogs}
                      visibleColumns={visibleColumns}
                      renderCellContent={renderCellContent}
                      pageSize={pageSize}
                    />
                ))
            )}
            {isExpanded && isFinalLevel && (
                <TableRow>
                    <TableCell colSpan={2} className="p-0 bg-muted/25" style={{ paddingLeft: `${1 + (level * 1.5)}rem` }}>
                        {logsData?.isLoading && <DrilldownSkeleton />}
                        {logsData && !logsData.isLoading && (
                            logsData.logs.length > 0 ? (
                                <div className="p-2">
                                    <Card className="shadow-none border-border/50">
                                        <CardContent className="p-0">
                                            <Table className="bg-background">
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="h-10 w-12 text-center">#</TableHead>
                                                        {visibleColumns.map(col => (
                                                            <TableHead key={col.id} className="h-10">
                                                                {col.name}
                                                            </TableHead>
                                                        ))}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {logsData.logs.map((log, index) => (
                                                        <React.Fragment key={log.id}>
                                                            <TableRow 
                                                                onClick={() => setExpandedRowId(prev => prev === log.id ? null : log.id)} 
                                                                className="cursor-pointer"
                                                                data-state={expandedRowId === log.id ? "selected" : undefined}
                                                            >
                                                                <TableCell className="text-center text-muted-foreground">
                                                                    {(logsData.page - 1) * pageSize + index + 1}
                                                                </TableCell>
                                                                {visibleColumns.map(col => (
                                                                    <TableCell key={col.id} className={cn("truncate", columnConfig.find(c => c.id === col.id)?.cellClassName)}>
                                                                        {renderCellContent(log, col.id)}
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
            
                                                            {expandedRowId === log.id && (
                                                                <TableRow>
                                                                    <TableCell colSpan={visibleColumns.length + 1}>
                                                                        <div className="p-4 bg-muted rounded-md space-y-3">
                                                                            <h4 className="text-sm font-semibold">Full Log Details</h4>
                                                                            <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-xs">
                                                                                {allColumns.map(col => (
                                                                                    <div key={col.id} className={cn("flex flex-col gap-1", (col.id === 'log_message' || col.id === 'report_id_name') && "md:col-span-3")}>
                                                                                        <dt className="font-medium text-muted-foreground">{col.name}</dt>
                                                                                        <dd className="flex items-start justify-between gap-2 font-mono">
                                                                                            <CopyableCell value={log[col.id]} as="span" className="whitespace-pre-wrap break-all pt-1" />
                                                                                        </dd>
                                                                                    </div>
                                                                                ))}
                                                                            </dl>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                        <CardFooter>
                                            <DataTablePagination
                                                page={logsData.page}
                                                pageSize={pageSize}
                                                total={logsData.total}
                                                setPage={(newPage) => onFetchLogs(currentPath, newPage)}
                                                isPending={logsData.isLoading}
                                            />
                                        </CardFooter>
                                    </Card>
                                </div>
                            ) : (
                                <div className="h-24 text-center text-muted-foreground flex items-center justify-center">
                                    No individual logs are available for this group.
                                </div>
                            )
                        )}
                    </TableCell>
                </TableRow>
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
  fetchLogsForDrilldown
}: ErrorTableProps) {
  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);
  const visibleColumns = React.useMemo(() => allColumns.filter(c => columnVisibility[c.id]), [allColumns, columnVisibility]);
  const visibleColumnCount = visibleColumns.length;
  
  const [resizingColumn, setResizingColumn] = React.useState<{ id: keyof ErrorLog; startX: number; startWidth: number; } | null>(null);

  const [groupLogsData, setGroupLogsData] = React.useState<Record<string, {
      logs: ErrorLog[];
      total: number;
      page: number;
      isLoading: boolean;
  }>>({});
  

  React.useEffect(() => {
    // When the grouping keys change, we must reset the state
    // of the expanded groups to avoid stale data and pagination.
    setGroupLogsData({});
  }, [groupBy]);

  const handleFetchGroupLogs = React.useCallback(async (path: Record<string, string>, page = 1) => {
    const groupKey = Object.values(path).join(':');
    setGroupLogsData(prev => ({ ...prev, [groupKey]: { ...(prev[groupKey] || { logs: [], total: 0 }), isLoading: true, page } }));
    
    try {
        const { logs, totalCount } = await fetchLogsForDrilldown(path, page);
        setGroupLogsData(prev => ({ ...prev, [groupKey]: { logs, total: totalCount, page, isLoading: false } }));
    } catch (error) {
        setGroupLogsData(prev => ({ ...prev, [groupKey]: { ...(prev[groupKey] || { logs: [], total: 0 }), isLoading: false } }));
    }
  }, [fetchLogsForDrilldown]);
  
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

  const renderCellContent = (log: ErrorLog, columnId: keyof ErrorLog) => {
    let value: React.ReactNode = log[columnId];
    
    switch (columnId) {
        case 'repository_path':
            const path = String(value);
            const lastSlashIndex = path.lastIndexOf('/');
            value = lastSlashIndex !== -1 ? path.substring(lastSlashIndex + 1) : path;
            break;
        case 'error_number':
            value = (
                <Badge variant={(value as number) >= 500 ? "destructive" : "secondary"}>
                    {value as number}
                </Badge>
            );
            break;
        default:
            // No change for other columns
            break;
    }

    return (
       <CopyableCell value={value} />
    );
  };

  const renderSkeleton = () => (
    Array.from({ length: 10 }).map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        <TableCell>
            <Skeleton className="h-6 w-8 mx-auto" />
        </TableCell>
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
        Array.from({ length: 10 }).map((_, i) => (
            <TableRow key={`grouped-skeleton-${i}`}>
                <TableCell><Skeleton className="h-8 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-8 w-1/4 ml-auto" /></TableCell>
            </TableRow>
        ))
    );

    return (
      <Card>
        <CardHeader>
          <CardTitle>Groups by {friendlyGroupNames}</CardTitle>
          <CardDescription>
            {isLoading ? 'Loading groups...' : (groupData && groupData.length > 0 ? 'Showing top groups. Click a row to expand.' : 'No groups to display.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <div className="rounded-md border">
              <Table>
                <colgroup>
                  <col style={{ width: '80%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-right">Error Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? renderGroupedSkeleton() : groupData && groupData.length > 0 ? (
                    groupData.map((item, index) => (
                      <GroupedRow 
                        key={`0-${item.key}-${index}`} 
                        item={item} 
                        level={0}
                        groupingKeys={groupBy}
                        parentPath={{}}
                        groupLogsData={groupLogsData}
                        onFetchLogs={handleFetchGroupLogs}
                        visibleColumns={visibleColumns}
                        renderCellContent={renderCellContent}
                        pageSize={pageSize}
                      />
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
          </TooltipProvider>
        </CardContent>
      </Card>
    );
  }


  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardDescription>
            {isLoading ? <Skeleton className="h-5 w-48" /> : `Showing ${logs.length > 0 ? `1-${logs.length}` : 0} of ${totalLogs.toLocaleString()} logs.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                  <col style={{ width: "4rem" }} />
                  {allColumns.map(column => (
                    columnVisibility[column.id] && (
                        <col key={column.id} style={{ width: columnWidths[column.id] ? `${columnWidths[column.id]}px` : undefined }} />
                    )
                  ))}
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">#</TableHead>
                  {allColumns.map(column => {
                      const config = columnConfig.find(c => c.id === column.id);
                      return columnVisibility[column.id] && (
                        <DataTableColumnHeader 
                          key={column.id}
                          column={column.id} 
                          title={column.name} 
                          sortDescriptor={sortDescriptor} 
                          setSortDescriptor={setSortDescriptor} 
                          columnFilters={config?.isFilterable ? columnFilters : undefined} 
                          setColumnFilters={config?.isFilterable ? setColumnFilters : undefined}
                          isPending={isLoading}
                          onResizeStart={handleResizeStart}
                        />
                      )
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? renderSkeleton() : logs.length > 0 ? (
                  logs.map((log, index) => (
                    <React.Fragment key={log.id}>
                      <TableRow
                        data-state={expandedRowId === log.id && "selected"}
                        className="cursor-pointer"
                        onClick={() => setExpandedRowId(prev => (prev === log.id ? null : log.id))}
                      >
                        <TableCell className="text-center text-muted-foreground">{(page - 1) * pageSize + index + 1}</TableCell>
                        {visibleColumns.map(column => {
                          const config = columnConfig.find(c => c.id === column.id);
                          return (
                            <TableCell key={column.id} className={cn(config?.cellClassName)}>
                              {renderCellContent(log, column.id)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      {expandedRowId === log.id && (
                        <TableRow>
                          <TableCell colSpan={visibleColumnCount + 1}>
                            <div className="p-4 bg-muted/50 rounded-md space-y-3">
                              <h4 className="text-sm font-semibold">Full Log Details</h4>
                              <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-xs">
                                {allColumns.map(col => (
                                    <div key={col.id} className={cn("flex flex-col gap-1", (col.id === 'log_message' || col.id === 'report_id_name') && "md:col-span-3")}>
                                      <dt className="font-semibold text-primary">{col.name}</dt>
                                      <dd className="flex items-start justify-between gap-2 font-mono">
                                          <CopyableCell value={log[col.id]} as="span" className="whitespace-pre-wrap break-all pt-1" />
                                      </dd>
                                    </div>
                                ))}
                              </dl>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={visibleColumnCount + 1} className="h-24 text-center">
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
