import React, { useState } from 'react';
import { cn } from '../../lib/utils';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  delayMs?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  className,
  delayMs = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<number | null>(null);

  const show = () => {
    const id = window.setTimeout(() => setIsVisible(true), delayMs);
    setTimeoutId(id);
  };

  const hide = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const sidePositions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {isVisible && content && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-50 px-2 py-1 text-[11px] font-medium text-primary-foreground bg-primary rounded shadow-md whitespace-nowrap pointer-events-none transition-opacity duration-150',
            sidePositions[side],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};
