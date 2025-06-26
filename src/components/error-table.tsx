"use client";

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
import { format } from "date-fns";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTablePagination } from "./data-table-pagination";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";

interface ErrorTableProps {
  logs: ErrorLog[];
  isLoading: boolean;
  sortDescriptor: SortDescriptor;
  setSortDescriptor: (descriptor: SortDescriptor) => void;
  anomalousLogIds: string[];
  page: number;
  pageSize: number;
  totalLogs: number;
  setPage: (page: number) => void;
  groupBy: GroupByOption;
  groupedLogs: GroupedLogs | null;
  columnFilters: ColumnFilters;
  setColumnFilters: (filters: React.SetStateAction<ColumnFilters>) => void;
}

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
  anomalousLogIds,
  page,
  pageSize,
  totalLogs,
  setPage,
  groupBy,
  groupedLogs,
  columnFilters,
  setColumnFilters,
}: ErrorTableProps) {

  const renderSkeleton = () => (
    Array.from({ length: 10 }).map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        <TableCell colSpan={6}>
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
            Showing {Object.keys(groupedLogs).length} groups with errors on this page. Anomalies are highlighted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {sortedGroupedLogs.map(([groupKey, groupData]) => (
              <AccordionItem value={groupKey} key={groupKey} className="border-b">
                 <AccordionTrigger className="hover:no-underline p-4">
                   <div className="flex justify-between items-center w-full">
                     <div className="flex items-center gap-4">
                       <span className="font-semibold truncate max-w-xs">{groupKey}</span>
                       <Badge variant="secondary">{groupData.count} {groupData.count > 1 ? 'errors' : 'error'}</Badge>
                     </div>
                     {groupData.anomalousCount > 0 && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge variant="destructive">{groupData.anomalousCount} {groupData.anomalousCount > 1 ? 'anomalies' : 'anomaly'}</Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Anomalies detected by AI</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                     )}
                   </div>
                 </AccordionTrigger>
                 <AccordionContent>
                   <div className="rounded-md border mt-2">
                     <Table>
                       <TableHeader>
                         <TableRow>
                           <TableHead>Timestamp</TableHead>
                           <TableHead>Repository</TableHead>
                           <TableHead>Error Code</TableHead>
                           <TableHead>Message</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {groupData.logs.map(log => (
                           <TableRow 
                            key={log.id}
                            className={anomalousLogIds.includes(log.id) ? "bg-accent/20 hover:bg-accent/30" : ""}
                            data-ai-hint={anomalousLogIds.includes(log.id) ? "anomaly detected" : undefined}
                           >
                             <TableCell className="font-mono text-xs">{format(new Date(log.log_date_time), "yyyy-MM-dd HH:mm:ss")}</TableCell>
                             <TableCell>{log.repository_path}</TableCell>
                             <TableCell>
                               <Badge variant={log.error_number >= 500 ? "destructive" : "secondary"}>
                                 {log.error_number}
                               </Badge>
                             </TableCell>
                             <TableCell className="max-w-[200px] sm:max-w-xs truncate">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>{log.log_message}</span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="max-w-md">{log.log_message}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                             </TableCell>
                           </TableRow>
                         ))}
                       </TableBody>
                     </Table>
                   </div>
                 </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Logs</CardTitle>
        <CardDescription>
          Showing {logs.length} of {totalLogs} errors. Anomalies detected by AI are highlighted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <DataTableColumnHeader column="log_date_time" title="Timestamp" sortDescriptor={sortDescriptor} setSortDescriptor={setSortDescriptor} />
                  <DataTableColumnHeader column="repository_path" title="Repository" sortDescriptor={sortDescriptor} setSortDescriptor={setSortDescriptor} columnFilters={columnFilters} setColumnFilters={setColumnFilters} />
                  <DataTableColumnHeader column="error_number" title="Error Code" sortDescriptor={sortDescriptor} setSortDescriptor={setSortDescriptor} columnFilters={columnFilters} setColumnFilters={setColumnFilters} />
                  <DataTableColumnHeader column="log_message" title="Message" sortDescriptor={sortDescriptor} setSortDescriptor={setSortDescriptor} columnFilters={columnFilters} setColumnFilters={setColumnFilters} />
                  <DataTableColumnHeader column="host_name" title="Host" sortDescriptor={sortDescriptor} setSortDescriptor={setSortDescriptor} columnFilters={columnFilters} setColumnFilters={setColumnFilters} />
                  <DataTableColumnHeader column="user_id" title="User" sortDescriptor={sortDescriptor} setSortDescriptor={setSortDescriptor} columnFilters={columnFilters} setColumnFilters={setColumnFilters} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? renderSkeleton() : logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow 
                      key={log.id} 
                      className={anomalousLogIds.includes(log.id) ? "bg-accent/20 hover:bg-accent/30 transition-colors duration-300" : ""}
                      data-ai-hint={anomalousLogIds.includes(log.id) ? "anomaly detected" : undefined}
                    >
                      <TableCell className="font-mono text-xs">{format(new Date(log.log_date_time), "yyyy-MM-dd HH:mm:ss")}</TableCell>
                      <TableCell>{log.repository_path}</TableCell>
                      <TableCell>
                        <Badge variant={log.error_number >= 500 ? "destructive" : "secondary"}>
                          {log.error_number}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] sm:max-w-xs truncate">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>{log.log_message}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="max-w-md">{log.log_message}</p>
                            </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.host_name}</TableCell>
                      <TableCell>{log.user_id}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
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
