import type { ReactNode } from 'react';
import { cn } from '@/utils';

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}

const toneStyles: Record<Tone, string> = {
  success: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800',
  danger: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800',
  warning: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800',
  info: 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 ring-brand-200 dark:ring-brand-800',
  neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ring-slate-200 dark:ring-slate-700',
};

const dotStyles: Record<Tone, string> = {
  success: 'bg-emerald-500',
  danger: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-brand-500',
  neutral: 'bg-slate-500',
};

/**
 * Badge com cores e indicador de status (dot / pulse).
 * @param tone - Cor do badge: "success" | "danger" | "warning" | "info" | "neutral"
 * @param dot - Exibe um indicador circular
 * @param pulse - Animação de pulsação no dot
 * @param children - Conteúdo textual do badge
 * @param className - Classes CSS adicionais
 */
export function Badge({ tone = 'neutral', dot, pulse, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        toneStyles[tone],
        className
      )}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                dotStyles[tone]
              )}
            />
          )}
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', dotStyles[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}
