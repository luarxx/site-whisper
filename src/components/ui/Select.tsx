import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';

interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[];
  placeholder?: string;
}

/**
 * Select estilizado com suporte a placeholder e descrição nas opções.
 * @param options - Lista de opções { value, label, description? }
 * @param placeholder - Texto placeholder (primeira opção desabilitada)
 * @param className - Classes CSS adicionais
 * @param props - Demais atributos HTML do select
 * @param ref - Ref encaminhada para o elemento <select>
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, className, ...props },
  ref
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        {...props}
        className={cn(
          'h-10 w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-3 pr-9 text-sm text-slate-800 dark:text-slate-200',
          'shadow-soft transition-all duration-150',
          'hover:border-slate-300 dark:hover:border-slate-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900/50',
          'disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400',
          className
        )}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
});
