import { useEffect, useState } from 'react';
import { Save, RotateCcw, Sliders, Cpu, Languages, Zap, Brain } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/store/useAppStore';
import {
  COMPUTE_TYPES,
  DEVICES,
  LANGUAGES,
  MODELS,
  type WhisperConfig,
} from '@/types';

export function ConfigForm() {
  const draft = useAppStore((s) => s.configDraft);
  const liveConfig = useAppStore((s) => s.config);
  const updateDraft = useAppStore((s) => s.updateConfigDraft);
  const saveConfig = useAppStore((s) => s.saveConfig);
  const refreshConfig = useAppStore((s) => s.refreshConfig);

  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!draft || !liveConfig) return;
    setHasChanges(JSON.stringify(draft) !== JSON.stringify(liveConfig));
  }, [draft, liveConfig]);

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
    return (
      <Card title="Configurações" description="Modelo e parâmetros do Faster-Whisper" icon={<Sliders className="h-5 w-5" />}>
        <p className="text-sm text-slate-500">
          Aguardando conexão com a API para carregar as configurações atuais.
        </p>
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

        <Field label="Tipo de computação" htmlFor="cfg-compute">
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

        <Field label="Idioma padrão" htmlFor="cfg-language">
          <div className="relative">
            <Languages className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Select
              id="cfg-language"
              value={draft.language}
              onChange={(e) => updateDraft({ language: e.target.value as WhisperConfig['language'] })}
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
              className="pl-9"
            />
          </div>
        </Field>

        <Field
          label="Beam size"
          hint="Número de beams no beam search. 1 = greedy, maior = mais preciso, mais lento."
          htmlFor="cfg-beam"
          className="md:col-span-2"
        >
          <div className="flex items-center gap-3">
            <input
              id="cfg-beam"
              type="number"
              min={1}
              max={10}
              step={1}
              value={draft.beam_size ?? 5}
              onChange={(e) => updateDraft({ beam_size: Math.max(1, Math.min(10, Number(e.target.value) || 5)) })}
              className="h-10 w-24 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-soft focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={draft.beam_size ?? 5}
              onChange={(e) => updateDraft({ beam_size: Number(e.target.value) })}
              className="flex-1 accent-brand-600"
            />
          </div>
        </Field>

        <div className="md:col-span-2">
          <Slider
            label="Temperatura de amostragem"
            value={draft.temperature}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => updateDraft({ temperature: value })}
            formatValue={(v) => v.toFixed(2)}
          />
        </div>

        <label className="md:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <Brain className="h-4 w-4 text-slate-500" />
            <div>
              <p className="text-sm font-medium text-slate-800">VAD Filter</p>
              <p className="text-xs text-slate-500">
                Filtra trechos de silêncio antes da transcrição (recomendado).
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={draft.vad_filter ?? true}
            onChange={(e) => updateDraft({ vad_filter: e.target.checked })}
            className="h-5 w-5 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
        </label>
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
