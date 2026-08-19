'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>');
  return ctx;
}

const STYLES = {
  success: { Icon: CheckCircle2, color: 'text-emerald-400' },
  error: { Icon: AlertCircle, color: 'text-red-400' },
  info: { Icon: Info, color: 'text-indigo-400' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 bottom-20 md:bottom-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const { Icon, color } = STYLES[t.type] || STYLES.info;
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-md px-4 py-3 shadow-2xl animate-slide-up"
            >
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${color}`} />
              <p className="text-sm text-slate-200 flex-1">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="text-slate-500 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}