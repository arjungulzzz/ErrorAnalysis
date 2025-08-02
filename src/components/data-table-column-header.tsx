
"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Filter } from "lucide-react";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { type ErrorLog, type SortDescriptor, type ColumnFilters, FilterCondition, FilterOperator } from "@/types";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { TagInput } from "./ui/tag-input";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

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

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const filterCondition = columnFilters?.[column];

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
  const filterValues = filterCondition?.values || [];
  const filterOperator = filterCondition?.operator || 'in';

  const handleFilterChange = (newCondition: FilterCondition | null) => {
    setColumnFilters?.(prev => {
      const newFilters = { ...prev };
      if (newCondition && newCondition.values.length > 0) {
        newFilters[column] = newCondition;
      } else {
        delete newFilters[column];
      }
      return newFilters;
    });
    setIsPopoverOpen(false); // Close popover on apply/clear
  };
  
  const FilterPopoverContent = () => {
    const [values, setValues] = useState(filterValues);
    const [operator, setOperator] = useState<FilterOperator>(filterOperator);
    const [pendingInputValue, setPendingInputValue] = useState('');
    const isNumericColumn = column === 'port_number' || column === 'error_number';

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        let finalValues = [...values];
        const newTag = pendingInputValue.trim();

        if (newTag) {
            const isNumeric = /^\d+$/.test(newTag);
            if (validationType === 'numeric' && !isNumeric) {
                // Ignore non-numeric input for numeric columns
            } else {
                const lowercasedValues = finalValues.map(v => v.toLowerCase());
                if (!lowercasedValues.includes(newTag.toLowerCase())) {
                    finalValues.push(newTag);
                }
            }
        }
        
        handleFilterChange({ operator, values: finalValues });
    };

    const validationType = isNumericColumn ? 'numeric' : 'text';

    return (
      <PopoverContent className="w-80" align="start" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Filter logic for {title}</Label>
            <RadioGroup value={operator} onValueChange={(v) => setOperator(v as FilterOperator)} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="in" id={`op-in-${column}`} />
                <Label htmlFor={`op-in-${column}`} className="font-normal">Is one of (IN)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="notIn" id={`op-notin-${column}`} />
                <Label htmlFor={`op-notin-${column}`} className="font-normal">Is none of (NOT IN)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="and" id={`op-and-${column}`} />
                <Label htmlFor={`op-and-${column}`} className="font-normal">Must contain all (AND)</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
             <Label htmlFor={`filter-${column}`}>Values</Label>
             <p className="text-xs text-muted-foreground mt-1">
              Enter values and press Enter. You can also paste comma or newline-separated values.
              {isNumericColumn && <span className="font-bold"> Only numbers are allowed.</span>}
            </p>
            <TagInput
              id={`filter-${column}`}
              placeholder={`Add values...`}
              value={values}
              onChange={setValues}
              onInputChange={setPendingInputValue}
              className="mt-2 h-auto"
              validationType={validationType}
            />
          </div>
          
          <div className="flex justify-between gap-2">
            <Button 
              type="button"
              variant="ghost" 
              size="sm"
              className="w-full h-8"
              onClick={() => handleFilterChange(null)}
            >
              Clear & Close
            </Button>
            <Button 
              type="submit"
              size="sm"
              className="w-full h-8"
            >
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    );
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
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className={cn("h-7 w-7 shrink-0", filterValues.length > 0 && "text-primary bg-accent/50")} disabled={isPending}>
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <FilterPopoverContent />
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
