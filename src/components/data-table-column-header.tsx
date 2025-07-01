"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ErrorLog, type SortDescriptor, type ColumnFilters } from "@/types";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: keyof ErrorLog;
  title: string;
  sortDescriptor: SortDescriptor;
  setSortDescriptor: (descriptor: SortDescriptor) => void;
  columnFilters?: ColumnFilters;
  setColumnFilters?: (filters: React.SetStateAction<ColumnFilters>) => void;
  isPending?: boolean;
  onResizeStart?: (columnId: keyof ErrorLog, e: React.MouseEvent) => void;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
  sortDescriptor,
  setSortDescriptor,
  columnFilters,
  setColumnFilters,
  isPending,
  onResizeStart,
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
  
  const isFilterable = !!setColumnFilters;
  const filterValue = columnFilters?.[column] || "";

  const handleFilterChange = (value: string) => {
    setColumnFilters?.(prev => ({
      ...prev,
      [column]: value,
    }));
  };

  return (
    <th className={cn("p-2 relative group", className)}>
       <div className="flex items-center justify-between space-x-1">
        <Button
            variant="ghost"
            onClick={handleSort}
            className="h-8 data-[state=open]:bg-accent px-2 flex-grow justify-start text-left"
            disabled={isPending}
        >
            <span className="truncate">{title}</span>
            {renderSortIcon()}
        </Button>
         {isFilterable && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className={cn("h-7 w-7 shrink-0", filterValue && "text-primary bg-accent/50")} disabled={isPending}>
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60" align="start" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-2">
                <Label htmlFor={`filter-${column}`}>Filter by {title}</Label>
                <Input
                  id={`filter-${column}`}
                  placeholder={`Filter...`}
                  value={filterValue}
                  onChange={(e) => handleFilterChange(e.target.value)}
                  className="h-8"
                />
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="w-full h-8"
                  disabled={!filterValue}
                  onClick={() => handleFilterChange('')}
                >
                  Clear filter
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
       {onResizeStart && (
        <div
          onMouseDown={(e) => onResizeStart(column, e)}
          className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-10 select-none touch-none opacity-0 group-hover:opacity-100"
        >
          <div className="h-full w-px bg-border group-hover:bg-primary transition-colors" />
        </div>
       )}
    </th>
  );
}
