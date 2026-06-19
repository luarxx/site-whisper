import { useState } from 'react';
import {
  AudioWaveform,
  Sliders,
  Terminal,
  Mic,
  Github,
  Menu,
  X,
  Smartphone,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/utils';
import { useAppStore } from '@/store/useAppStore';

export type SectionId = 'transcribe' | 'config' | 'logs' | 'whatsapp';

interface NavItem {
  id: SectionId;
  label: string;
  description: string;
  icon: typeof AudioWaveform;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'transcribe', label: 'Transcrição', description: 'Áudio para texto', icon: AudioWaveform },
  { id: 'config', label: 'Configurações', description: 'Modelo e parâmetros', icon: Sliders },
  { id: 'logs', label: 'Logs', description: 'Saída do servidor', icon: Terminal },
  { id: 'whatsapp', label: 'WhatsApp', description: 'Vincular ao WhatsApp', icon: Smartphone },
];

interface SidebarProps {
  active: SectionId;
  onSelect: (id: SectionId) => void;
}

/**
 * Sidebar de navegação com seções "Conexão" e "Transcrição".
 * @param active - ID da seção atualmente ativa
 * @param onSelect - Callback ao selecionar uma seção
 */
export function Sidebar({ active, onSelect }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed left-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-card ring-1 ring-slate-200 dark:ring-slate-700 lg:hidden"
        aria-label={open ? 'Fechar menu' : 'Abrir menu'}
      >
        {open ? <X className="h-5 w-5 text-slate-700 dark:text-slate-200" /> : <Menu className="h-5 w-5 text-slate-700 dark:text-slate-200" />}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-6',
          'pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]',
          'transition-transform duration-300 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center gap-3 px-2 pb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Whisper Control</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Faster-Whisper · Dashboard</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 ring-1 ring-inset ring-brand-100 dark:ring-brand-800'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                    isActive
                      ? 'bg-brand-600 text-white shadow-soft'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="mt-4 space-y-2">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          </button>
          <a
            href="https://github.com/SYSTRAN/faster-whisper"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <span className="truncate">Faster-Whisper</span>
            <Github className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
          </a>
        </div>
      </aside>
    </>
  );
}
