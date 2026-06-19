import { useId, useMemo } from 'react';
import { cn } from '@/utils';

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  hint?: string;
  formatValue?: (value: number) => string;
  className?: string;
  disabled?: boolean;
}

/**
 * Slider (input range) com label, formatação e exibição de valores min/max.
 * @param value - Valor atual
 * @param min - Valor mínimo (padrão: 0)
 * @param max - Valor máximo (padrão: 1)
 * @param step - Incremento (padrão: 0.05)
 * @param onChange - Callback chamado ao alterar o valor
 * @param label - Rótulo exibido acima do slider
 * @param formatValue - Função para formatar o valor exibido (padrão: toString)
 * @param className - Classes CSS adicionais
 * @param disabled - Desabilita o slider
 */
export function Slider({
  value,
  min = 0,
  max = 1,
  step = 0.05,
  onChange,
  label,
  hint,
  formatValue,
  className,
  disabled = false,
}: SliderProps) {
  const id = useId();
  const percent = useMemo(() => {
    if (max === min) return 0;
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  }, [value, min, max]);

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">{label}</span>
          <span className="font-mono text-slate-700 dark:text-slate-300">{formatValue ? formatValue(value) : value}</span>
        </div>
      )}
      <div className="relative">
        <input
          id={id}
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            'h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 dark:bg-slate-700',
            'accent-brand-600 disabled:cursor-not-allowed disabled:opacity-60',
            '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-brand-600 [&::-webkit-slider-thumb]:shadow-soft',
            '[&::-webkit-slider-thumb]:transition-transform',
            '[&::-webkit-slider-thumb]:hover:scale-110',
            '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4',
            '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0',
            '[&::-moz-range-thumb]:bg-brand-600'
          )}
          style={{
            background: `linear-gradient(to right, rgb(28 126 245) 0%, rgb(28 126 245) ${percent}%, rgb(226 232 240) ${percent}%, rgb(226 232 240) 100%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}
