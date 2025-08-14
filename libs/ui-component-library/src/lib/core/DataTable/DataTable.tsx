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
import { cn } from '@letta-cloud/ui-styles';
import { Button } from '../Button/Button';
import type { Dispatch, SetStateAction } from 'react';
import { useRef } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { LoadingEmptyStatusComponent } from '../../reusable/LoadingEmptyStatusComponent/LoadingEmptyStatusComponent';
import { TABLE_ROW_HEIGHT, TABLE_ROW_MINIMUM_COUNT } from '../../../constants';
import { SearchIcon } from '../../icons';
import './DataTable.scss';

interface TableBodyContentProps<Data> {
  table: UseReactTableType<Data>;
  columnLength: number;
  onRowClick?: (row: Data) => void;
  isLoading?: boolean;
  noResultsAction?: React.ReactNode;
  noResultsText?: string;
  loadingText?: string;
  errorMessage?: string;
}

function TableBodyContent<Data>(props: TableBodyContentProps<Data>) {
  const {
    table,
    columnLength,
    onRowClick,
    loadingText,
    errorMessage,
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
              isError={!!errorMessage}
              noMinHeight
              className="min-h-[100%] absolute pt-[100px] top-0 left-0"
              errorMessage={errorMessage}
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
            className={cn(
              '',
              onRowClick ? 'cursor-pointer  hover:bg-secondary-hover' : '',
            )}
            onClick={() => {
              onRowClick?.(row.original);
            }}
            key={row.id}
            data-state={row.getIsSelected() && 'selected'}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell
                align={cell.column.columnDef.meta?.style?.columnAlign}
                className={cn(
                  cell.column.columnDef.meta?.style?.sticky === 'left' &&
                    'sticky left-0',
                  cell.column.columnDef.meta?.style?.sticky === 'right' &&
                    'sticky right-0',
                  cell.column.columnDef.meta?.style?.sticky &&
                    'linear-gradient-background',
                  '',
                )}
                style={{
                  width: cell.column.columnDef.meta?.style?.width,
                }}
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

const dataTableVariants = cva('h-full', {
  variants: {
    variant: {
      default: '',
      minimal: 'border-none',
    },
    fullHeight: {
      true: 'h-full flex-1',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

interface DataTablePropsBase<TData, TValue> {
  columns: Array<ColumnDef<TData, TValue>>;
  data: TData[];
  page?: number;
  onSetPage?: Dispatch<SetStateAction<number>>;
  onSearch?: (search: string) => void;
  searchValue?: string;
  onRowClick?: (row: TData) => void;
  onLimitChange?: (limit: number) => void;
  isLoading?: boolean;
  loadingText?: string;
  noResultsText?: string;
  className?: string;
  onSetOffset?: Dispatch<SetStateAction<number>>;
  onSetCursor?: Dispatch<SetStateAction<TData | undefined>>;
  hasNextPage?: boolean;
  showPagination?: boolean;
  noResultsAction?: React.ReactNode;
  errorMessage?: string;
  autofitHeight?: boolean;
  limit?: number;
  bottomLeftContent?: React.ReactNode;
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
    errorMessage,
    onSetPage,
    page,
    bottomLeftContent,
    onSetCursor,
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
    onSearch,
    fullHeight,
    onLimitChange,
  } = props;

  const lastCursor = useRef<TData | undefined>(undefined);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableParentRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (autofitHeight && tableContainerRef.current && tableParentRef.current) {
      if (mounted.current) {
        return;
      }

      // get the top position of the table
      let { height } = tableContainerRef.current.getBoundingClientRect();

      if (typeof minHeight === 'number') {
        height = Math.max(height, minHeight);
      }

      // calculate the number of rows that can fit in the table
      const rows = Math.floor(height / TABLE_ROW_HEIGHT) - 1;

      mounted.current = true;

      onLimitChange?.(Math.max(rows, TABLE_ROW_MINIMUM_COUNT));
    }
  }, [autofitHeight, limit, minHeight, onLimitChange]);

  const handleNextPage = useCallback(() => {
    if (isLoading) {
      return;
    }

    if (onSetCursor) {
      lastCursor.current = data[data.length - 1];

      onSetCursor(lastCursor.current);

      return;
    }

    if (onSetPage) {
      onSetPage((prev) => prev + 1);
    }

    if (onSetOffset) {
      onSetOffset((prev) => prev + limit);
    }
  }, [data, isLoading, limit, onSetPage, onSetCursor, onSetOffset]);

  const handlePreviousPage = useCallback(() => {
    if (isLoading) {
      return;
    }

    if (onSetCursor) {
      onSetCursor(lastCursor.current);
    }

    if (onSetPage) {
      onSetPage((prev) => Math.max(prev - 1, 0));
    }

    if (onSetOffset) {
      onSetOffset((prev) => prev - limit);
    }
  }, [isLoading, limit, onSetPage, onSetCursor, onSetOffset]);

  const hasPreviousPage = useMemo(() => {
    if (isLoading) {
      return false;
    }

    if (page) {
      return page > 0;
    }

    return offset > 0;
  }, [isLoading, page, offset]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div
      ref={tableParentRef}
      className={cn(
        'flex flex-col gap-2 w-full',
        fullHeight || autofitHeight ? 'h-full flex-1' : '',
      )}
    >
      {props.onSearch && (
        <RawInput
          preIcon={<SearchIcon />}
          fullWidth
          placeholder="Search"
          label="Search"
          hideLabel
          onChange={(e) => {
            if (onSearch) {
              onSearch(e.target.value);

              if (onSetCursor) {
                lastCursor.current = undefined;
                onSetCursor(lastCursor.current);
              }

              if (onSetOffset) {
                onSetOffset(0);
              }
            }
          }}
          value={props.searchValue}
        />
      )}
      <div
        ref={tableContainerRef}
        className={cn(
          dataTableVariants({
            variant,
            fullHeight: fullHeight || autofitHeight,
            className,
          }),
          'relative',
        )}
        style={{
          minHeight: !autofitHeight && minHeight ? `${minHeight}px` : '',
          height:
            !autofitHeight && limit
              ? `${(limit + 1) * TABLE_ROW_HEIGHT}px`
              : '',
        }}
      >
        <div
          className={cn(
            variant !== 'minimal' ? '' : '',
            'w-full h-full absolute top-0 border  fake-border touch-none pointer-events-none',
          )}
        />

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      align={header.column.columnDef.meta?.style.columnAlign}
                      className={cn(
                        header.column.columnDef.meta?.style.sticky === 'left' &&
                          'sticky left-0',
                        header.column.columnDef.meta?.style.sticky ===
                          'right' && 'sticky right-0',
                        header.column.columnDef.meta?.style.sticky &&
                          'linear-gradient-background',
                      )}
                      style={{
                        width: header.column.columnDef.meta?.style.width,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
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
            errorMessage={errorMessage}
            noResultsAction={noResultsAction}
            columnLength={columns.length}
            isLoading={isLoading}
            noResultsText={noResultsText}
          />
        </Table>
      </div>
      {showPagination && (
        <div className="flex items-center justify-between space-x-2 py-4">
          {bottomLeftContent ? bottomLeftContent : <div />}
          <div className="space-x-2">
            <Button
              onClick={() => {
                handlePreviousPage();
              }}
              color="secondary"
              disabled={!hasPreviousPage}
              label="Previous"
            ></Button>
            <Button
              onClick={() => {
                handleNextPage();
              }}
              color="secondary"
              disabled={!hasNextPage}
              label="Next"
            />
          </div>
        </div>
      )}
    </div>
  );
}
