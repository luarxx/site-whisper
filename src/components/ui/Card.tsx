import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
}

/**
 * Cartão com cabeçalho opcional (título, descrição, ícone, ações) e corpo.
 * @param title - Título do cartão
 * @param description - Descrição / subtítulo
 * @param icon - Ícone exibido ao lado do título
 * @param actions - Ações no canto superior direito
 * @param padded - Se true (padrão), aplica padding interno
 * @param className - Classes CSS adicionais
 * @param children - Conteúdo do corpo do cartão
 */
export function Card({
  title,
  description,
  icon,
  actions,
  padded = true,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <section
      {...props}
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white',
        className
      )}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                {icon}
              </div>
            )}
            <div className="space-y-0.5">
              {title && (
                <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
              )}
              {description && (
                <p className="text-xs text-slate-500">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padded ? 'p-5' : '')}>{children}</div>
    </section>
  );
}
