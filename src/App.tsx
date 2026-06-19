import { useEffect, useState } from 'react';
import { Sidebar, type SectionId } from '@/components/Sidebar';
import { AudioUploader } from '@/components/AudioUploader';
import { ConfigForm } from '@/components/ConfigForm';
import { LogViewer } from '@/components/LogViewer';
import { WhatsAppPanel } from '@/components/WhatsAppPanel';
import { Toaster } from '@/components/ui/Toaster';
import { useAppStore } from '@/store/useAppStore';

const SECTION_IDS: SectionId[] = ['transcribe', 'config', 'logs', 'whatsapp'];

export function App() {
  const [active, setActive] = useState<SectionId>('transcribe');
  const checkConnection = useAppStore((s) => s.checkConnection);
  const refreshConfig = useAppStore((s) => s.refreshConfig);
  const dismissToast = useAppStore((s) => s.dismissToast);
  const toasts = useAppStore((s) => s.toasts);

  useEffect(() => {
    void checkConnection();
    void refreshConfig();
    const id = window.setInterval(() => {
      void checkConnection();
      void refreshConfig();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [checkConnection, refreshConfig]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === 'Escape') {
        if (toasts.length > 0) {
          dismissToast(toasts[toasts.length - 1].id);
          return;
        }
      }

      if (isInput || e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
        const idx = Number(e.key) - 1;
        if (SECTION_IDS[idx]) {
          setActive(SECTION_IDS[idx]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toasts, dismissToast]);

  return (
    <div className="flex h-full min-h-screen bg-slate-50">
      <Sidebar active={active} onSelect={setActive} />

      <main className="min-w-0 flex-1 overflow-y-auto pb-safe">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <header className="flex flex-col gap-1 pt-[max(2.5rem,env(safe-area-inset-top,0px))] lg:pt-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {getTitle(active)}
            </h1>
            <p className="text-sm text-slate-500">{getDescription(active)}</p>
          </header>

          {active === 'transcribe' && (
            <div className="space-y-6 animate-fade-in">
              <AudioUploader />
            </div>
          )}

          {active === 'config' && (
            <div className="space-y-6 animate-fade-in">
              <ConfigForm />
            </div>
          )}

          {active === 'logs' && (
            <div className="space-y-6 animate-fade-in">
              <LogViewer />
            </div>
          )}

          {active === 'whatsapp' && (
            <div className="space-y-6 animate-fade-in">
              <WhatsAppPanel />
            </div>
          )}
        </div>
      </main>

      <Toaster />
    </div>
  );
}

/**
 * Retorna o título da página conforme a seção ativa.
 * @param id - Identificador da seção
 */
function getTitle(id: SectionId): string {
  switch (id) {
    case 'transcribe':
      return 'Transcrição de Áudio';
    case 'config':
      return 'Configurações';
    case 'logs':
      return 'Logs do Servidor';
    case 'whatsapp':
      return 'WhatsApp';
  }
}

/**
 * Retorna a descrição da página conforme a seção ativa.
 * @param id - Identificador da seção
 */
function getDescription(id: SectionId): string {
  switch (id) {
    case 'transcribe':
      return 'Faça upload de um áudio e receba a transcrição em segundos.';
    case 'config':
      return 'Ajuste o modelo, device e parâmetros de inferência do Faster-Whisper.';
    case 'logs':
      return 'Visualize a saída do servidor em tempo real.';
    case 'whatsapp':
      return 'Conecte seu WhatsApp para transcrição automática de áudios.';
  }
}
