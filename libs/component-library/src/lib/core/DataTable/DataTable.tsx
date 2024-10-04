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
import { useRef } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { LoadingEmptyStatusComponent } from '../../reusable/LoadingEmptyStatusComponent/LoadingEmptyStatusComponent';
import { TABLE_ROW_HEIGHT } from '../../../constants';

interface TableBodyContentProps<Data> {
  table: UseReactTableType<Data>;
  columnLength: number;
  onRowClick?: (row: Data) => void;
  isLoading?: boolean;
  noResultsAction?: React.ReactNode;
  noResultsText?: string;
  loadingText?: string;
}

function TableBodyContent<Data>(props: TableBodyContentProps<Data>) {
  const {
    table,
    columnLength,
    onRowClick,
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
            <LoadingEmptyStatusComponent
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
          <TableRow
            className={
              onRowClick ? 'cursor-pointer hover:bg-tertiary-hover' : ''
            }
            onClick={() => {
              onRowClick?.(row.original);
            }}
            key={row.id}
            data-state={row.getIsSelected() && 'selected'}
          >
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
  onRowClick?: (row: TData) => void;
  onLimitChange?: (limit: number) => void;
  isLoading?: boolean;
  loadingText?: string;
  noResultsText?: string;
  className?: string;
  onSetOffset?: Dispatch<SetStateAction<number>>;
  hasNextPage?: boolean;
  showPagination?: boolean;
  noResultsAction?: React.ReactNode;
  autofitHeight?: boolean;
  limit?: number;
  minHeight?: number;
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
    minHeight,
    limit = 0,
    offset = 0,
    isLoading,
    onRowClick,
    hasNextPage,
    autofitHeight,
    className,
    noResultsText,
    showPagination,
    fullHeight,
    onLimitChange,
  } = props;

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (autofitHeight && tableContainerRef.current) {
      if (mounted.current) {
        return;
      }

      // get the top position of the table
      const top = tableContainerRef.current.getBoundingClientRect().top;

      // get the height of the window
      const windowHeight = window.innerHeight;

      // calculate the height of the table
      let height = windowHeight - top - TABLE_ROW_HEIGHT;

      if (typeof minHeight === 'number') {
        height = Math.max(height, minHeight);
      }

      // calculate the number of rows that can fit in the table
      const rows = Math.floor(height / TABLE_ROW_HEIGHT);

      tableContainerRef.current.style.minHeight = `${
        rows * TABLE_ROW_HEIGHT
      }px`;
      tableContainerRef.current.style.height = `${rows * TABLE_ROW_HEIGHT}px`;

      mounted.current = true;

      onLimitChange?.(rows);
    }
  }, [autofitHeight, minHeight, onLimitChange]);

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
      ref={tableContainerRef}
      style={{ minHeight: minHeight }}
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
            onRowClick={onRowClick}
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
                handlePreviousPage();
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
