import React, { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { ...toast, id };

      setToasts((prev) => [...prev, newToast]);

      const duration = toast.durationMs ?? 4000;
      if (duration > 0) {
        window.setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      return id;
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      {/* Toast viewport */}
      <div
        role="region"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />,
    error: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
    info: <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />,
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border border-border bg-surface text-foreground shadow-lg transition-all',
        'animate-in fade-in slide-in-from-bottom-2'
      )}
    >
      {icons[toast.type]}
      <div className="flex-1 space-y-0.5 text-xs">
        <p className="font-semibold text-foreground">{toast.title}</p>
        {toast.message && <p className="text-muted-foreground leading-relaxed">{toast.message}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
