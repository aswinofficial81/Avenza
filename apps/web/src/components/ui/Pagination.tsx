import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
}) => {
  if (totalPages <= 1) return null;

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn('flex items-center justify-between gap-2 select-none', className)}
    >
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
      >
        Previous
      </Button>

      <div className="flex items-center gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
          const isCurrent = page === currentPage;
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              aria-current={isCurrent ? 'page' : undefined}
              className={cn(
                'h-8 w-8 text-xs font-mono rounded flex items-center justify-center transition-colors',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring',
                isCurrent
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
              )}
            >
              {page}
            </button>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
      >
        Next
      </Button>
    </nav>
  );
};
