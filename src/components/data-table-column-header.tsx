"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ErrorLog, type SortDescriptor } from "@/types";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: keyof ErrorLog;
  title: string;
  sortDescriptor: SortDescriptor;
  setSortDescriptor: (descriptor: SortDescriptor) => void;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
  sortDescriptor,
  setSortDescriptor,
}: DataTableColumnHeaderProps<TData, TValue>) {

  const handleSort = () => {
    if (sortDescriptor.column === column) {
      if (sortDescriptor.direction === 'ascending') {
        setSortDescriptor({ column, direction: 'descending' });
      } else {
        setSortDescriptor({ column: null, direction: null });
      }
    } else {
      setSortDescriptor({ column, direction: 'ascending' });
    }
  };

  const renderSortIcon = () => {
    if (sortDescriptor.column !== column) {
      return <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/70" />;
    }
    return sortDescriptor.direction === 'descending' ? (
      <ArrowDown className="ml-2 h-4 w-4" />
    ) : (
      <ArrowUp className="ml-2 h-4 w-4" />
    );
  };

  return (
    <th className={cn("p-2", className)}>
      <Button
        variant="ghost"
        onClick={handleSort}
        className="h-8 data-[state=open]:bg-accent px-2"
      >
        <span>{title}</span>
        {renderSortIcon()}
      </Button>
    </th>
  );
}
