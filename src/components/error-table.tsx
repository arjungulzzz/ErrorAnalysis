"use client";

import { type ErrorLog, type SortDescriptor } from "@/types";
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
}

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
                  <DataTableColumnHeader column="repository_path" title="Repository" sortDescriptor={sortDescriptor} setSortDescriptor={setSortDescriptor} />
                  <DataTableColumnHeader column="error_number" title="Error Code" sortDescriptor={sortDescriptor} setSortDescriptor={setSortDescriptor} />
                  <DataTableColumnHeader column="log_message" title="Message" sortDescriptor={sortDescriptor} setSortDescriptor={setSortDescriptor} />
                  <DataTableColumnHeader column="host_name" title="Host" sortDescriptor={sortDescriptor} setSortDescriptor={setSortDescriptor} />
                  <DataTableColumnHeader column="user_id" title="User" sortDescriptor={sortDescriptor} setSortDescriptor={setSortDescriptor} />
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
