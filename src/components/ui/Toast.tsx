import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-4 right-0 left-0 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => {
          const isError = toast.type === 'error';
          const isSuccess = toast.type === 'success';

          return (
            <div
              key={toast.id}
              role={isError ? 'alert' : 'status'}
              className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-3 ${
                isError
                  ? 'border-rose-500/30 bg-rose-950/90 text-rose-100 shadow-rose-950/40'
                  : isSuccess
                  ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-100 shadow-emerald-950/40'
                  : 'border-sky-500/30 bg-zinc-900/90 text-zinc-100 shadow-black/50'
              }`}
            >
              {isError && <AlertCircle className="size-5 shrink-0 text-rose-400" aria-hidden="true" />}
              {isSuccess && <CheckCircle2 className="size-5 shrink-0 text-emerald-400" aria-hidden="true" />}
              {!isError && !isSuccess && <Info className="size-5 shrink-0 text-sky-400" aria-hidden="true" />}
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-200"
                aria-label="Close notification"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

