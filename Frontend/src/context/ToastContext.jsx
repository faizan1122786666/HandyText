import React, { createContext, useContext, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { CheckCircle2, AlertCircle, AlertTriangle, X, Info } from 'lucide-react';
import { cn } from '../utils/cn';

const ToastContext = createContext(null);

// Visual config per toast type: a gradient icon badge, a short title, a soft
// glow and a matching countdown bar — a clean, modern toast.
const TOAST_VARIANTS = {
  success: {
    title: 'Success',
    Icon: CheckCircle2,
    badge: 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30',
    bar: 'bg-emerald-500',
    glow: 'shadow-emerald-500/10',
  },
  error: {
    title: 'Something went wrong',
    Icon: AlertCircle,
    badge: 'bg-gradient-to-br from-rose-400 to-red-600 shadow-red-500/30',
    bar: 'bg-red-500',
    glow: 'shadow-red-500/10',
  },
  warning: {
    title: 'Heads up',
    Icon: AlertTriangle,
    badge: 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/30',
    bar: 'bg-amber-500',
    glow: 'shadow-amber-500/10',
  },
  info: {
    title: 'Notice',
    Icon: Info,
    badge: 'bg-gradient-to-br from-blue-400 to-[#3461ff] shadow-blue-500/30',
    bar: 'bg-[#3461ff]',
    glow: 'shadow-blue-500/10',
  },
};

export function ToastProvider({ children }) {
  const addToast = useCallback((message, type = 'success') => {
    const variant = TOAST_VARIANTS[type] || TOAST_VARIANTS.info;
    const { Icon } = variant;
    const duration = type === 'error' ? 5000 : 3500;

    return toast.custom(
      (t) => (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'group pointer-events-auto relative flex items-start gap-3 w-[min(92vw,400px)] p-3.5 pr-3 overflow-hidden',
            'bg-white/95 backdrop-blur-xl rounded-2xl ring-1 ring-slate-900/[0.06]',
            'shadow-[0_12px_40px_-8px_rgba(15,23,42,0.25)] transition-all duration-300 ease-out',
            variant.glow,
            t.visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-[120%]',
          )}
        >
          {/* Icon badge */}
          <div className={cn('shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg', variant.badge)}>
            <Icon size={18} strokeWidth={2.4} />
          </div>

          {/* Title + message */}
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-slate-400 leading-none mb-1">
              {variant.title}
            </p>
            <p className="text-[13.5px] leading-snug font-semibold text-slate-800 break-words">
              {message}
            </p>
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            aria-label="Dismiss notification"
            className="shrink-0 text-slate-300 hover:text-slate-600 transition-colors p-1.5 -mt-0.5 rounded-lg hover:bg-slate-100"
          >
            <X size={15} strokeWidth={2.5} />
          </button>

          {/* Countdown bar (pauses while hovered, in sync with react-hot-toast) */}
          <div className="absolute left-0 bottom-0 h-1 w-full bg-slate-100/70">
            <div
              className={cn('toast-progress-bar h-full rounded-full group-hover:[animation-play-state:paused]', variant.bar)}
              style={{ animationDuration: `${duration}ms` }}
            />
          </div>
        </div>
      ),
      { duration },
    );
  }, []);

  const removeToast = useCallback((id) => toast.dismiss(id), []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <Toaster
        position="top-right"
        gutter={12}
        containerStyle={{ top: 24, right: 24 }}
        toastOptions={{ duration: 3500 }}
      />
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
