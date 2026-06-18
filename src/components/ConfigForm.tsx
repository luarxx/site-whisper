import { useCallback, useEffect, useState } from 'react';
import { Save, RotateCcw, Sliders, Cpu, Zap, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/store/useAppStore';
import {
  COMPUTE_TYPES,
  DEVICES,
  MODELS,
  type WhisperConfig,
} from '@/types';

export function ConfigForm() {
  const draft = useAppStore((s) => s.configDraft);
  const liveConfig = useAppStore((s) => s.config);
  const isOnline = useAppStore((s) => s.isOnline);
  const isConnecting = useAppStore((s) => s.isConnecting);
  const updateDraft = useAppStore((s) => s.updateConfigDraft);
  const saveConfig = useAppStore((s) => s.saveConfig);
  const refreshConfig = useAppStore((s) => s.refreshConfig);

  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  useEffect(() => {
    if (!draft || !liveConfig) return;
    setHasChanges(JSON.stringify(draft) !== JSON.stringify(liveConfig));
  }, [draft, liveConfig]);

  const loadConfig = useCallback(async () => {
    if (isLoadingConfig || draft) return;
    setIsLoadingConfig(true);
    try {
      await refreshConfig();
    } finally {
      setIsLoadingConfig(false);
    }
  }, [refreshConfig, isLoadingConfig, draft]);

  useEffect(() => {
    if (isOnline && !draft) {
      loadConfig();
    }
  }, [isOnline, draft, loadConfig]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveConfig();
    } catch {
      /* erro já tratado via toast */
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (liveConfig) {
      updateDraft(liveConfig);
    }
  };

  if (!draft) {
    const loading = isLoadingConfig || isConnecting;

    return (
      <Card title="Configurações" description="Modelo e parâmetros do Faster-Whisper" icon={<Sliders className="h-5 w-5" />}>
        {loading ? (
          <div className="flex items-center gap-3 py-4">
            <RefreshCw className="h-4 w-4 animate-spin text-brand-600" />
            <p className="text-sm text-slate-500">Carregando configurações do servidor...</p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <p className="text-sm text-slate-500">
              {isOnline
                ? 'Não foi possível carregar as configurações. Verifique se a API está respondendo.'
                : 'Aguardando conexão com a API para carregar as configurações atuais.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              disabled={!isOnline}
              onClick={loadConfig}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Tentar novamente
            </Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card
      title="Configurações do Faster-Whisper"
      description="Ajuste o modelo, device e parâmetros de inferência"
      icon={<Sliders className="h-5 w-5" />}
      actions={
        hasChanges && (
          <Badge tone="warning" dot>
            Alterações não salvas
          </Badge>
        )
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label="Modelo"
          hint={`VRAM estimado: ${MODELS.find((m) => m.value === draft.model)?.vram ?? '—'}`}
          htmlFor="cfg-model"
        >
          <Select
            id="cfg-model"
            value={draft.model}
            onChange={(e) => updateDraft({ model: e.target.value as WhisperConfig['model'] })}
            options={MODELS.map((m) => ({ value: m.value, label: m.label }))}
          />
        </Field>

        <Field label="Device de execução" htmlFor="cfg-device">
          <div className="relative">
            <Cpu className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Select
              id="cfg-device"
              value={draft.device}
              onChange={(e) => updateDraft({ device: e.target.value as WhisperConfig['device'] })}
              options={DEVICES.map((d) => ({ value: d.value, label: d.label }))}
              className="pl-9"
            />
          </div>
        </Field>

        <Field
          label="Tipo de computação"
          htmlFor="cfg-compute"
          hint="Controla a precisão numérica do modelo. float16 e int8 são mais rápidos e usam menos memória; float32 é mais preciso porém mais lento. Escolha conforme seu hardware e necessidade de acurácia."
        >
          <Select
            id="cfg-compute"
            value={draft.compute_type}
            onChange={(e) => updateDraft({ compute_type: e.target.value as WhisperConfig['compute_type'] })}
            options={COMPUTE_TYPES.map((c) => ({
              value: c.value,
              label: c.label,
              description: c.description,
            }))}
          />
        </Field>

      </div>

      <footer className="mt-6 flex flex-col-reverse items-stretch gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={!hasChanges || saving}
          leftIcon={<RotateCcw className="h-4 w-4" />}
        >
          Descartar
        </Button>
        <Button
          variant="secondary"
          onClick={() => void refreshConfig()}
          leftIcon={<Zap className="h-4 w-4" />}
        >
          Recarregar
        </Button>
        <Button
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges}
          leftIcon={<Save className="h-4 w-4" />}
        >
          Salvar e reiniciar modelo
        </Button>
      </footer>
    </Card>
  );
}
