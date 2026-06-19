import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/utils';

interface Option {
  value: string;
  label: string;
  description?: string;
}

interface SelectWithDescriptionProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
}

export function SelectWithDescription({
  options,
  value,
  onChange,
  id,
  className,
}: SelectWithDescriptionProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, handleClose]);

  return (
    <div ref={ref} className={cn('relative', className)} id={id}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-xl border bg-white dark:bg-slate-800 px-3 text-sm text-slate-800 dark:text-slate-200 shadow-soft transition-all duration-150',
          open
            ? 'border-brand-400 ring-2 ring-brand-100 dark:ring-brand-900/50'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900/50'
        )}
      >
        <span className="truncate">{selected?.label ?? 'Selecione...'}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-card animate-fade-in">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    handleClose();
                  }}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors',
                    isSelected
                      ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  )}
                >
                  <Check
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      isSelected ? 'text-brand-600' : 'text-transparent'
                    )}
                  />
                  <div className="min-w-0">
                    <p className="font-medium">{opt.label}</p>
                    {opt.description && (
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{opt.description}</p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
