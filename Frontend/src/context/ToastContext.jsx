import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react';
import { cn } from '../utils/cn';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-center gap-3 px-6 py-3.5 bg-white rounded-2xl shadow-2xl border border-slate-100 min-w-[300px] animate-in slide-in-from-bottom-4 duration-300",
              toast.type === 'success' && "border-l-4 border-l-emerald-500",
              toast.type === 'error' && "border-l-4 border-l-red-500",
              toast.type === 'info' && "border-l-4 border-l-[#3461ff]"
            )}
          >
            <div className={cn(
              "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
              toast.type === 'success' && "bg-emerald-50 text-emerald-500",
              toast.type === 'error' && "bg-red-50 text-red-500",
              toast.type === 'info' && "bg-blue-50 text-[#3461ff]"
            )}>
              {toast.type === 'success' && <CheckCircle2 size={18} />}
              {toast.type === 'error' && <AlertCircle size={18} />}
              {toast.type === 'info' && <Info size={18} />}
            </div>
            <p className="text-[13px] font-bold text-slate-800 flex-1">{toast.message}</p>
            <button 
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
