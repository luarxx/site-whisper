import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/utils';

const iconMap = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <AlertCircle className="h-5 w-5 text-rose-500" />,
  info: <Info className="h-5 w-5 text-brand-500" />,
} as const;

const borderMap = {
  success: 'border-emerald-200',
  error: 'border-rose-200',
  info: 'border-brand-200',
} as const;

export function Toaster(): ReactNode {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-card',
            'animate-fade-in',
            borderMap[toast.type]
          )}
        >
          <div className="mt-0.5">{iconMap[toast.type]}</div>
          <p className="flex-1 text-sm text-slate-700">{toast.message}</p>
          <button
            onClick={() => dismiss(toast.id)}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
