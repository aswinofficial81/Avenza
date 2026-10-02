import React from 'react';
import { cn } from '../../lib/utils';

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-x-auto rounded-lg border border-border">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('border-b border-border bg-surface-2', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('border-t border-border bg-surface-2 font-medium', className)}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  isSelected?: boolean;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, isSelected, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-border-subtle transition-colors hover:bg-surface-2/60',
        isSelected && 'bg-surface-2',
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 px-4 text-left align-middle font-medium text-xs uppercase tracking-wider text-muted-foreground select-none',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-4 align-middle text-foreground font-mono text-xs', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

export const TableEmpty = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & { colSpan: number }
>(({ className, colSpan, children = 'No records found.', ...props }, ref) => (
  <tr>
    <td
      ref={ref}
      colSpan={colSpan}
      className={cn('p-8 text-center text-xs text-muted-foreground font-sans', className)}
      {...props}
    >
      {children}
    </td>
  </tr>
));
TableEmpty.displayName = 'TableEmpty';
