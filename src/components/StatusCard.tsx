import { useEffect, useState } from 'react';
import { RefreshCw, Globe } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useAppStore } from '@/store/useAppStore';

export function StatusCard() {
  const isOnline = useAppStore((s) => s.isOnline);
  const isConnecting = useAppStore((s) => s.isConnecting);
  const apiBaseUrl = useAppStore((s) => s.apiBaseUrl);
  const setApiBaseUrl = useAppStore((s) => s.setApiBaseUrl);
  const checkConnection = useAppStore((s) => s.checkConnection);

  const [urlDraft, setUrlDraft] = useState(apiBaseUrl);

  useEffect(() => {
    setUrlDraft(apiBaseUrl);
  }, [apiBaseUrl]);

  const handleConnect = () => {
    setApiBaseUrl(urlDraft.trim());
    window.setTimeout(() => void checkConnection(), 50);
  };

  return (
    <Card
      title="Conexão com a API"
      description="Endpoint da API Whisper (OpenAI-compatible)"
      icon={<Globe className="h-5 w-5" />}
      actions={
        <Badge
          tone={isOnline ? 'success' : isConnecting ? 'warning' : 'danger'}
          dot
          pulse={isOnline || isConnecting}
        >
          {isOnline ? 'Online' : isConnecting ? 'Conectando…' : 'Offline'}
        </Badge>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Field
            label="URL da API"
            htmlFor="api-url"
            hint="Endereço do servidor Faster-Whisper"
            className="flex-1"
          >
            <input
              id="api-url"
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="http://<ip-vps>:8000"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-soft transition-all hover:border-slate-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </Field>
          <Button
            onClick={handleConnect}
            loading={isConnecting}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Testar conexão
          </Button>
        </div>

        {isOnline && (
          <p className="text-sm text-emerald-600">
            ✓ Servidor respondedo em <code className="font-mono text-xs">{apiBaseUrl}</code>
          </p>
        )}
      </div>
    </Card>
  );
}
