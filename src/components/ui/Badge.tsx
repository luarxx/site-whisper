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
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  info: 'bg-brand-50 text-brand-700 ring-brand-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
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
