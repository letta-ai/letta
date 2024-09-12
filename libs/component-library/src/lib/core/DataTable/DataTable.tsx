'use client';

import type { ColumnDef } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Table as UseReactTableType,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../Table/Table';
import { RawInput } from '../Input/Input';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@letta-web/core-style-config';
import { Button } from '../Button/Button';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { DashboardStatusComponent } from '../../reusable/DashboardStatusComponent/DashboardStatusComponent';

interface TableBodyContentProps<Data> {
  table: UseReactTableType<Data>;
  columnLength: number;
  isLoading?: boolean;
  noResultsAction?: React.ReactNode;
  noResultsText?: string;
  loadingText?: string;
}

function TableBodyContent<Data>(props: TableBodyContentProps<Data>) {
  const {
    table,
    columnLength,
    loadingText,
    noResultsAction,
    isLoading,
    noResultsText,
  } = props;

  if (isLoading || table.getRowModel().rows.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={columnLength} className="h-full min-h-24">
            <DashboardStatusComponent
              loadingMessage={loadingText}
              emptyAction={noResultsAction}
              emptyMessage={noResultsText || 'No results found'}
              isLoading={isLoading}
            />
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  if (table.getRowModel().rows.length) {
    return (
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
            {row.getVisibleCells().map((cell) => (
              <TableCell
                align={cell.column.columnDef.meta?.style.columnAlign}
                key={cell.id}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    );
  }

  return null;
}

const dataTableVariants = cva('', {
  variants: {
    variant: {
      default: 'rounded-md border',
      minimal: 'border-none',
    },
    fullHeight: {
      true: 'h-full',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

interface DataTablePropsBase<TData, TValue> {
  columns: Array<ColumnDef<TData, TValue>>;
  data: TData[];
  onSearch?: (search: string) => void;
  searchValue?: string;
  isLoading?: boolean;
  loadingText?: string;
  noResultsText?: string;
  className?: string;
  onSetOffset?: Dispatch<SetStateAction<number>>;
  showPagination?: boolean;
  noResultsAction?: React.ReactNode;
  limit?: number;
  offset?: number;
}

type DataTableProps<TData, TValue> = DataTablePropsBase<TData, TValue> &
  VariantProps<typeof dataTableVariants>;

export function DataTable<TData, TValue>(props: DataTableProps<TData, TValue>) {
  const {
    onSetOffset,
    columns,
    variant,
    data,
    loadingText,
    noResultsAction,
    limit = 0,
    offset = 0,
    isLoading,
    className,
    noResultsText,
    showPagination,
    fullHeight,
  } = props;

  const handleNextPage = useCallback(() => {
    if (isLoading) {
      return;
    }

    if (onSetOffset) {
      onSetOffset((prev) => prev + limit);
    }
  }, [isLoading, limit, onSetOffset]);

  const handlePreviousPage = useCallback(() => {
    if (isLoading) {
      return;
    }

    if (onSetOffset) {
      onSetOffset((prev) => prev - limit);
    }
  }, [isLoading, limit, onSetOffset]);

  const hasNextPage = useMemo(() => {
    if (isLoading) {
      return false;
    }

    return data.length >= limit;
  }, [data.length, isLoading, limit]);

  const hasPreviousPage = useMemo(() => {
    if (isLoading) {
      return false;
    }

    return offset > 0;
  }, [isLoading, offset]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    if (data.length === 0 && hasPreviousPage && !isLoading) {
      handlePreviousPage();
    }
  }, [data.length, handlePreviousPage, hasPreviousPage, isLoading]);

  return (
    <div
      className={cn('flex flex-col gap-2 w-full', fullHeight ? 'h-full' : '')}
    >
      {props.onSearch && (
        <RawInput
          fullWidth
          placeholder="Search"
          label="Search"
          hideLabel
          onChange={(e) => props.onSearch?.(e.target.value)}
          value={props.searchValue}
        />
      )}
      <div
        className={cn(dataTableVariants({ variant, fullHeight, className }))}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      align={header.column.columnDef.meta?.style.columnAlign}
                      key={header.id}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBodyContent
            table={table}
            loadingText={loadingText}
            noResultsAction={noResultsAction}
            columnLength={columns.length}
            isLoading={isLoading}
            noResultsText={noResultsText}
          />
        </Table>
      </div>
      {showPagination && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <div />
          <div className="space-x-2">
            <Button
              onClick={() => {
                handleNextPage();
              }}
              color="tertiary"
              disabled={!hasPreviousPage}
              label="Previous"
            ></Button>
            <Button
              onClick={() => {
                handleNextPage();
              }}
              color="tertiary"
              disabled={!hasNextPage}
              label="Next"
            />
          </div>
        </div>
      )}
    </div>
  );
}
