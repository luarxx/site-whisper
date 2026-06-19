import { useEffect, useCallback } from 'react';
import { Smartphone, QrCode, Link2, Unlink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/store/useAppStore';

const STATE_LABEL: Record<string, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }> = {
  idle: { label: 'Desconectado', tone: 'neutral' },
  connecting: { label: 'Conectando...', tone: 'warning' },
  connected: { label: 'Conectado', tone: 'success' },
  error: { label: 'Erro', tone: 'danger' },
};

export function WhatsAppPanel() {
  const whatsAppConfig = useAppStore((s) => s.whatsAppConfig);
  const whatsAppState = useAppStore((s) => s.whatsAppState);
  const whatsAppQrCode = useAppStore((s) => s.whatsAppQrCode);
  const whatsAppError = useAppStore((s) => s.whatsAppError);
  const setWhatsAppConfig = useAppStore((s) => s.setWhatsAppConfig);
  const createWhatsAppInstance = useAppStore((s) => s.createWhatsAppInstance);
  const checkWhatsAppStatus = useAppStore((s) => s.checkWhatsAppStatus);
  const disconnectWhatsApp = useAppStore((s) => s.disconnectWhatsApp);

  useEffect(() => {
    void checkWhatsAppStatus();
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

  const isConnected = whatsAppState === 'connected';
  const isConnecting = whatsAppState === 'connecting';
  const status = STATE_LABEL[whatsAppState] ?? STATE_LABEL.idle;

  return (
    <div className="space-y-6">
      <Card
        icon={<Smartphone className="h-5 w-5" />}
        title="Vincular WhatsApp"
        description="Conecte-se à Evolution API para receber áudios do WhatsApp e transcrevê-los automaticamente."
        padded
      >
        <div className="space-y-5">
          <Field label="URL da Evolution API" htmlFor="evolution-url">
            <input
              id="evolution-url"
              type="text"
              value={whatsAppConfig.evolutionApiUrl}
              onChange={(e) => setWhatsAppConfig({ evolutionApiUrl: e.target.value })}
              placeholder="http://localhost:8080"
              disabled={isConnected || isConnecting}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 transition-colors hover:border-slate-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />
          </Field>

          <Field label="API Key" htmlFor="evolution-key">
            <input
              id="evolution-key"
              type="password"
              value={whatsAppConfig.apiKey}
              onChange={(e) => setWhatsAppConfig({ apiKey: e.target.value })}
              placeholder="Chave de API da Evolution"
              disabled={isConnected || isConnecting}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 transition-colors hover:border-slate-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />
          </Field>

          <div className="flex items-center gap-3">
            {!isConnected ? (
              <Button
                onClick={handleConnect}
                loading={isConnecting}
                leftIcon={<Link2 className="h-4 w-4" />}
                disabled={!whatsAppConfig.apiKey || isConnecting}
              >
                {isConnecting ? 'Conectando...' : 'Conectar'}
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={disconnectWhatsApp}
                leftIcon={<Unlink className="h-4 w-4" />}
              >
                Desconectar
              </Button>
            )}

            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          </div>

          {whatsAppError && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-rose-600">
              <AlertCircle className="h-4 w-4" />
              {whatsAppError}
            </p>
          )}
        </div>
      </Card>

      {whatsAppQrCode && !isConnected && (
        <Card
          icon={<QrCode className="h-5 w-5" />}
          title="Escaneie o QR Code"
          description="Abra o WhatsApp no seu celular, vá em Menu > WhatsApp Web e escaneie o código abaixo."
          padded
        >
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-2 sm:p-4 shadow-soft">
              <img
                src={`data:image/png;base64,${whatsAppQrCode}`}
                alt="QR Code do WhatsApp"
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
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Envie áudios no seu próprio chat (fale com você mesmo) e a transcrição
              será enviada de volta automaticamente.
            </p>
            <div className="rounded-xl bg-brand-50 px-4 py-3 text-brand-700">
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
    </div>
  );
}
