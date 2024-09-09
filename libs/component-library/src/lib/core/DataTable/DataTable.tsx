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
import { useEffect } from 'react';

interface TableBodyContentProps<Data> {
  table: UseReactTableType<Data>;
  columnLength: number;
  isLoading?: boolean;

  noResultsText?: string;
}

function TableBodyContent<Data>(props: TableBodyContentProps<Data>) {
  const { table, columnLength, isLoading, noResultsText } = props;

  if (isLoading) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={columnLength} className="h-24 text-center">
            Loading...
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
                // @ts-expect-error need to fix this type
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

  return (
    <TableBody>
      <TableRow>
        <TableCell colSpan={columnLength} className="h-24 text-center">
          {noResultsText || 'No results found'}
        </TableCell>
      </TableRow>
    </TableBody>
  );
}

const dataTableVariants = cva('', {
  variants: {
    variant: {
      default: 'rounded-md border',
      minimal: 'border-none',
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
  noResultsText?: string;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
  showPagination?: boolean;
}

type DataTableProps<TData, TValue> = DataTablePropsBase<TData, TValue> &
  VariantProps<typeof dataTableVariants>;

export function DataTable<TData, TValue>(props: DataTableProps<TData, TValue>) {
  const {
    hasNextPage,
    hasPreviousPage,
    onNextPage,
    onPreviousPage,
    columns,
    variant,
    data,
    isLoading,
    noResultsText,
    showPagination,
  } = props;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  useEffect(() => {
    if (data.length === 0 && hasPreviousPage && !isLoading) {
      onPreviousPage?.();
    }
  }, [data.length, hasPreviousPage, isLoading, onPreviousPage]);

  return (
    <div className="flex flex-col gap-2">
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
      <div className={cn(dataTableVariants({ variant }))}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      // @ts-expect-error need to fix this type
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
            {onPreviousPage && (
              <Button
                onClick={() => {
                  onPreviousPage();
                }}
                color="tertiary"
                disabled={!hasPreviousPage}
                label="Previous"
              ></Button>
            )}
            {onNextPage && (
              <Button
                onClick={() => {
                  onNextPage();
                }}
                color="tertiary"
                disabled={!hasNextPage}
                label="Next"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
