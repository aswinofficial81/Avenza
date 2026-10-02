import React, { createContext, useContext, useState } from 'react';
import { cn } from '../../lib/utils';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (val: string) => void;
}

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
  value?: string;
  onValueChange?: (val: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
  ...props
}) => {
  const [internalTab, setInternalTab] = useState(defaultValue);
  const activeTab = value !== undefined ? value : internalTab;

  const setActiveTab = (val: string) => {
    if (value === undefined) setInternalTab(val);
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('w-full space-y-4', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        'inline-flex h-9 items-center justify-center rounded bg-surface-2 p-1 text-muted-foreground border border-border-subtle',
        className
      )}
      {...props}
    />
  )
);
TabsList.displayName = 'TabsList';

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, children, ...props }, ref) => {
    const ctx = useContext(TabsContext);
    if (!ctx) throw new Error('TabsTrigger must be used within Tabs');

    const isSelected = ctx.activeTab === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isSelected}
        onClick={() => ctx.setActiveTab(value)}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-xs font-medium transition-all select-none',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring',
          isSelected
            ? 'bg-surface text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const ctx = useContext(TabsContext);
    if (!ctx) throw new Error('TabsContent must be used within Tabs');

    if (ctx.activeTab !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn('focus-visible:outline-none', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = 'TabsContent';
