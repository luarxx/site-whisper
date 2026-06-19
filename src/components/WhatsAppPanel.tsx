import { useEffect, useCallback, useRef } from 'react';
import { Smartphone, QrCode, Link2, Unlink, CheckCircle2, AlertCircle, Loader2, Pause, Play, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/store/useAppStore';

const STATE_LABEL: Record<string, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }> = {
  idle: { label: 'Desconectado', tone: 'neutral' },
  connecting: { label: 'Conectando...', tone: 'warning' },
  connected: { label: 'Conectado', tone: 'success' },
  paused: { label: 'Pausado', tone: 'warning' },
  error: { label: 'Erro', tone: 'danger' },
};

export function WhatsAppPanel() {
  const whatsAppState = useAppStore((s) => s.whatsAppState);
  const whatsAppQrCode = useAppStore((s) => s.whatsAppQrCode);
  const whatsAppError = useAppStore((s) => s.whatsAppError);
  const createWhatsAppInstance = useAppStore((s) => s.createWhatsAppInstance);
  const checkWhatsAppStatus = useAppStore((s) => s.checkWhatsAppStatus);
  const pauseWhatsApp = useAppStore((s) => s.pauseWhatsApp);
  const resumeWhatsApp = useAppStore((s) => s.resumeWhatsApp);
  const disconnectWhatsApp = useAppStore((s) => s.disconnectWhatsApp);

  const retriesRef = useRef(0);
  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | null = null;
    const maxRetries = 4;

    const attempt = () => {
      void checkWhatsAppStatus().then(() => {
        const state = useAppStore.getState().whatsAppState;
        if (state !== 'idle' || retriesRef.current >= maxRetries) return;
        retriesRef.current++;
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current - 1), 8000);
        id = setTimeout(attempt, delay);
      });
    };

    attempt();

    return () => {
      if (id) clearTimeout(id);
    };
  }, [checkWhatsAppStatus]);

  useEffect(() => {
    if (whatsAppState !== 'connecting') return;
    const id = window.setInterval(() => {
      void checkWhatsAppStatus();
    }, 3_000);
    return () => window.clearInterval(id);
  }, [whatsAppState, checkWhatsAppStatus]);

  const handleConnect = useCallback(() => {
    void createWhatsAppInstance();
  }, [createWhatsAppInstance]);

  const handleCheckStatus = useCallback(() => {
    void checkWhatsAppStatus();
  }, [checkWhatsAppStatus]);

  const isConnected = whatsAppState === 'connected';
  const isPaused = whatsAppState === 'paused';
  const isConnecting = whatsAppState === 'connecting';
  const status = STATE_LABEL[whatsAppState] ?? STATE_LABEL.idle;

  const qrSrc = whatsAppQrCode
    ? whatsAppQrCode.startsWith("data:")
      ? whatsAppQrCode
      : `data:image/png;base64,${whatsAppQrCode}`
    : undefined;

  return (
    <div className="space-y-6">
      <Card
        icon={<Smartphone className="h-5 w-5" />}
        title="Vincular WhatsApp"
        description="Conecte-se à Evolution API para receber áudios do WhatsApp e transcrevê-los automaticamente."
        padded
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            A conexão utiliza a Evolution API configurada no servidor. Clique em <strong>Conectar</strong> para iniciar.
          </p>

          <div className="flex items-center gap-3">
            {isConnected && (
              <>
                <Button
                  variant="secondary"
                  onClick={pauseWhatsApp}
                  leftIcon={<Pause className="h-4 w-4" />}
                >
                  Pausar
                </Button>
                <Button
                  variant="danger"
                  onClick={disconnectWhatsApp}
                  leftIcon={<Unlink className="h-4 w-4" />}
                >
                  Desconectar
                </Button>
              </>
            )}

            {isPaused && (
              <>
                <Button
                  onClick={resumeWhatsApp}
                  loading={isConnecting}
                  leftIcon={<Play className="h-4 w-4" />}
                >
                  {isConnecting ? 'Conectando...' : 'Retomar'}
                </Button>
                <Button
                  variant="danger"
                  onClick={disconnectWhatsApp}
                  leftIcon={<Unlink className="h-4 w-4" />}
                >
                  Desconectar
                </Button>
              </>
            )}

            {!isConnected && !isPaused && (
              <>
                <Button
                  onClick={handleConnect}
                  loading={isConnecting}
                  leftIcon={<Link2 className="h-4 w-4" />}
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Conectando...' : 'Conectar'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleCheckStatus}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                  disabled={isConnecting}
                >
                  Verificar
                </Button>
              </>
            )}

            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          </div>

          {whatsAppError && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4" />
              {whatsAppError}
            </p>
          )}
        </div>
      </Card>

      {whatsAppQrCode && !isConnected && !isPaused && (
        <Card
          icon={<QrCode className="h-5 w-5" />}
          title="Escaneie o QR Code"
          description="Abra o WhatsApp no seu celular, vá em Menu > WhatsApp Web e escaneie o código abaixo."
          padded
        >
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 sm:p-4 shadow-soft">
              <img
                src={qrSrc}
                alt="QR Code do WhatsApp"
                width={192}
                height={192}
                className="h-48 w-48 sm:h-64 sm:w-64"
              />
            </div>
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Aguardando leitura do QR Code...
            </p>
          </div>
        </Card>
      )}

      {isConnected && (
        <Card
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          title="WhatsApp Conectado"
          description="Seu WhatsApp está vinculado e pronto para transcrição automática."
          padded
        >
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>
              Envie áudios no seu próprio chat (fale com você mesmo) e a transcrição
              será enviada de volta automaticamente.
            </p>
            <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 px-4 py-3 text-brand-700 dark:text-brand-300">
              <p className="text-xs font-medium uppercase tracking-wide">Como usar</p>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm">
                <li>Abra o WhatsApp no celular</li>
                <li>Toque em "Falar comigo mesmo"</li>
                <li>Envie um áudio</li>
                <li>Receba a transcrição na resposta</li>
              </ol>
            </div>
          </div>
        </Card>
      )}

      {isPaused && (
        <Card
          icon={<Pause className="h-5 w-5 text-amber-600" />}
          title="WhatsApp Pausado"
          description="A conexão com o WhatsApp está pausada. Seus áudios não serão transcritos enquanto estiver pausado."
          padded
        >
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>
              Clique em <strong>Retomar</strong> para reconectar o WhatsApp. Se a
              sessão ainda for válida, a conexão será restabelecida sem precisar
              escanear o QR Code novamente.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
