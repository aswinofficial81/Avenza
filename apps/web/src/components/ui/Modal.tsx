import React, { useEffect, useRef, useId } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  size = 'md',
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const titleId = useId();
  const descId = useId();

  // Handle focus restoration and escape key
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }

      // Focus trap
      if (e.key === 'Tab' && contentRef.current) {
        const focusables = contentRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (first && last) {
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus first element or container
    const timer = setTimeout(() => {
      if (contentRef.current) {
        const focusable = contentRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable) {
          focusable.focus();
        } else {
          contentRef.current.focus();
        }
      }
    }, 50);

    // Prevent background scrolling
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop overlay */}
      <div
        ref={overlayRef}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
      />

      {/* Modal Dialog Content */}
      <div
        ref={contentRef}
        tabIndex={-1}
        className={cn(
          'relative w-full rounded-lg border border-border bg-surface text-foreground shadow-2xl p-6 transition-all outline-none',
          sizeClasses[size],
          className
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-sm text-muted-foreground hover:text-foreground p-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
        >
          <X className="w-4 h-4" />
        </button>

        {title && (
          <div className="mb-4 space-y-1 pr-6">
            <h3 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h3>
            {description && (
              <p id={descId} className="text-xs text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}

        <div>{children}</div>
      </div>
    </div>
  );
};
