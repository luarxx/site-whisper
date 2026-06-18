import type { ReactNode } from 'react';
import { cn } from '@/utils';

interface FieldProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Campo de formulário com label, hint e mensagem de erro.
 * @param label - Texto do label
 * @param hint - Texto de dica exibido abaixo do campo
 * @param htmlFor - ID do input associado (para foco ao clicar no label)
 * @param error - Mensagem de erro exibida no lugar do hint
 * @param children - Elemento de input / controle
 * @param className - Classes CSS adicionais
 */
export function Field({ label, hint, htmlFor, error, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium uppercase tracking-wide text-slate-600"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
