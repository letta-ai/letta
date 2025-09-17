import * as React from 'react';
import { cn } from '@letta-cloud/ui-styles';
import { cva, type VariantProps } from 'class-variance-authority';
import { TABLE_ROW_HEIGHT } from '../../../constants';

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-auto">
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b ', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
      className,
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b max-h-[53px] transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className,
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, align, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-head-cell px-3 text-left align-middle text-text-lighter font-bold whitespace-nowrap text-ellipsis    [&:has([role=checkbox])]:pr-0',
      align === 'right' && 'text-right',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const tableCellVariants = cva(
  'whitespace-nowrap align-middle [&:has([role=checkbox])]:pr-0',
  {
    variants: {
      size: {
        default: 'px-4',
        compact: 'px-2 py-1',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

interface TableCellProps
  extends React.TdHTMLAttributes<HTMLTableCellElement>,
    VariantProps<typeof tableCellVariants> {}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, style, size, ...props }, ref) => {
    const height = size === 'compact' ? '24px' : TABLE_ROW_HEIGHT;

    return (
      <td
        ref={ref}
        style={{ ...style, height }}
        className={cn(tableCellVariants({ size }), className)}
        {...props}
      />
    );
  }
);
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-muted-foreground', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

interface TableCellInputProps {
  label: string;
  value: string;
  testId?: string;
  placeholder: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const TableCellInput = React.forwardRef<
  HTMLTableCellElement,
  TableCellInputProps
>((props, ref) => {
  const { label, testId, value, placeholder, onChange } = props;

  return (
    <TableCell className="focus-within:outline-1 " ref={ref}>
      <div className="sr-only">{label}</div>
      <input
        autoComplete="off"
        data-testid={testId}
        className="px-2 w-full h-full bg-transparent border-0 focus:ring-0"
        value={value}
        placeholder={placeholder}
        onChange={onChange}
      />
    </TableCell>
  );
});

export {
  Table,
  TableHeader,
  TableBody,
  TableCellInput,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
