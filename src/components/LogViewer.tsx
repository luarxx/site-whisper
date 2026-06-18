import { useEffect, useRef, useState } from 'react';
import { Terminal, RefreshCw, Pause, Play, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/utils';
import type { LogLine } from '@/types';

const LEVEL_TONE: Record<LogLine['level'], string> = {
  INFO: 'text-sky-300',
  WARN: 'text-amber-300',
  ERROR: 'text-rose-300',
  DEBUG: 'text-slate-500',
};

export function LogViewer() {
  const logs = useAppStore((s) => s.logs);
  const isOnline = useAppStore((s) => s.isOnline);
  const isLoadingLogs = useAppStore((s) => s.isLoadingLogs);
  const refreshLogs = useAppStore((s) => s.refreshLogs);

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalSec] = useState(3);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!isOnline) return;
    void refreshLogs();
  }, [isOnline, refreshLogs]);

  useEffect(() => {
    if (!autoRefresh || !isOnline) return;
    const id = window.setInterval(() => void refreshLogs(), intervalSec * 1000);
    return () => window.clearInterval(id);
  }, [autoRefresh, intervalSec, isOnline, refreshLogs]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filtered = filter
    ? logs.filter((l) =>
        l.message.toLowerCase().includes(filter.toLowerCase()) ||
        l.level.toLowerCase().includes(filter.toLowerCase())
      )
    : logs;

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setAutoScroll(atBottom);
  };

  return (
    <Card
      title="Logs do Servidor"
      description="Saída do main.py rodando na VPS"
      icon={<Terminal className="h-5 w-5" />}
      actions={
        <div className="flex items-center gap-2">
          <Badge tone={isOnline ? 'success' : 'neutral'} dot pulse={isOnline && autoRefresh}>
            {isOnline ? 'Live' : 'Pausado'}
          </Badge>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar…"
            className="h-8 w-32 rounded-lg border border-slate-200 bg-white px-2.5 text-xs shadow-soft focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:w-44"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refreshLogs()}
            loading={isLoadingLogs}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Atualizar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
            leftIcon={autoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          >
            {autoRefresh ? 'Pausar' : 'Retomar'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => useAppStore.setState({ logs: [] })}
            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
            aria-label="Limpar buffer local"
          />
        </div>
      }
      padded={false}
    >
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={cn(
          'relative h-96 overflow-y-auto rounded-b-2xl bg-surface-0 font-mono text-[12.5px] leading-relaxed',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-surface-0/95 px-4 py-2 backdrop-blur">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            <span className="ml-2 text-[10px] uppercase tracking-widest text-slate-500">
              whisper-api@vps
            </span>
          </div>
          <span className="text-[10px] text-slate-500">
            {filtered.length} {filtered.length === 1 ? 'linha' : 'linhas'}
          </span>
        </div>

        <div className="px-4 py-3">
          {filtered.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-center text-slate-500">
              <div>
                <Terminal className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">
                  {isOnline
                    ? 'Aguardando novas linhas de log…'
                    : 'Conecte-se à API para visualizar os logs.'}
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((line, idx) => (
                <li
                  key={`${line.timestamp}-${idx}`}
                  className="flex gap-3 whitespace-pre-wrap break-all hover:bg-white/[0.02]"
                >
                  <span className="shrink-0 text-slate-500">{line.timestamp}</span>
                  <span className={cn('shrink-0 font-semibold', LEVEL_TONE[line.level])}>
                    [{line.level}]
                  </span>
                  <span className="text-slate-200">{line.message}</span>
                </li>
              ))}
              <li className="mt-2 flex items-center gap-1 text-slate-500">
                <span>$</span>
                <span className="h-3 w-2 animate-blink bg-slate-400" />
              </li>
            </ul>
          )}
        </div>

        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true);
              if (containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
              }
            }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white shadow-card hover:bg-brand-700"
          >
            ↓ Voltar ao fim
          </button>
        )}
      </div>
    </Card>
  );
}
