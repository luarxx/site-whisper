import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload,
  FileAudio,
  X,
  Copy,
  Check,
  Loader2,
  Square,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Settings2,
  Languages,
  Grid3X3,
  Brain,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { useAppStore } from '@/store/useAppStore';
import { formatBytes, formatDuration, cn } from '@/utils';
import { LANGUAGES, MODELS } from '@/types';

const ACCEPTED = '.mp3,.wav,.m4a,.ogg,.flac,.webm,.mp4,audio/*';

interface FileState {
  file: File;
  durationSec: number | null;
}

export function AudioUploader() {
  const isOnline = useAppStore((s) => s.isOnline);
  const isTranscribing = useAppStore((s) => s.isTranscribing);
  const transcription = useAppStore((s) => s.transcription);
  const setTranscription = useAppStore((s) => s.setTranscription);
  const config = useAppStore((s) => s.config);
  const pushToast = useAppStore((s) => s.pushToast);
  const startTranscription = useAppStore((s) => s.startTranscription);
  const cancelTranscription = useAppStore((s) => s.cancelTranscription);
  const transcribeError = useAppStore((s) => s.transcribeError);
  const transcribeOpts = useAppStore((s) => s.transcribeOpts);
  const setTranscribeOpts = useAppStore((s) => s.setTranscribeOpts);

  const [state, setState] = useState<FileState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showOpts, setShowOpts] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (state?.file && isOnline && !isTranscribing) {
          handleTranscribe();
        }
      }
      if (e.key === 'Escape' && isTranscribing) {
        e.preventDefault();
        cancelTranscription();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, isOnline, isTranscribing, cancelTranscription]);

  /**
   * Define o arquivo de áudio selecionado e tenta obter sua duração.
   * @param file - Arquivo de áudio (File)
   */
  const setFile = useCallback((file: File) => {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|flac|webm|mp4)$/i)) {
      useAppStore.getState().pushToast({
        type: 'error',
        message: 'Formato não suportado. Use mp3, wav, m4a, ogg ou flac.',
      });
      return;
    }
    setState({ file, durationSec: null });
    setTranscription('');

    if (file.type.startsWith('audio/')) {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = URL.createObjectURL(file);
      audio.onloadedmetadata = () => {
        setState((prev) => (prev ? { ...prev, durationSec: audio.duration } : prev));
        URL.revokeObjectURL(audio.src);
      };
    }
  }, [setTranscription]);

  /**
   * Processa a seleção de arquivo via input file.
   * @param e - Evento de change do input
   */
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFile(file);
  };

  /**
   * Processa o arquivo solto na área de drop.
   * @param e - Evento de drag & drop
   */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setFile(file);
  };

  /** Limpa o arquivo selecionado e a transcrição (sem parâmetros). */
  const clear = () => {
    setState(null);
    setTranscription('');
    if (inputRef.current) inputRef.current.value = '';
  };

  /**
   * Envia o áudio para transcrição via API.
   * (sem parâmetros — usa state e opts do componente)
   */
  const handleTranscribe = async () => {
    if (!state?.file) return;
    if (!isOnline) {
      pushToast({ type: 'error', message: 'API está offline. Conecte-se primeiro.' });
      return;
    }
    await startTranscription(state.file, transcribeOpts);
  };

  /**
   * Copia a transcrição para a área de transferência.
   * (sem parâmetros — usa transcription do state)
   */
  const handleCopy = async () => {
    if (!transcription) return;
    await navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Card
      title="Transcrição Rápida"
      description="Envie um arquivo de áudio e obtenha o texto transcrito"
      icon={<Sparkles className="h-5 w-5" />}
    >
      <div className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Selecionar arquivo de áudio para transcrição"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
          }}
          className={cn(
            'group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all',
            'cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-300',
            isDragging
              ? 'border-brand-400 bg-brand-50/60'
              : 'border-slate-200 bg-slate-50/40 hover:border-brand-300 hover:bg-brand-50/30'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={handleInput}
          />
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-soft ring-1 ring-slate-200 transition-transform group-hover:scale-105">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">
              {isDragging ? 'Solte o arquivo aqui' : 'Arraste e solte o áudio aqui'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              ou <span className="font-medium text-brand-600">clique para selecionar um arquivo</span> ·
              MP3, WAV, M4A, OGG, FLAC
            </p>
          </div>
        </div>

        {state && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 animate-fade-in">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <FileAudio className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800" title={state.file.name}>
                {state.file.name}
              </p>
              <p className="text-xs text-slate-500">
                {formatBytes(state.file.size)}
                {state.durationSec !== null && ` · ${formatDuration(state.durationSec)}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              aria-label="Remover arquivo"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {transcribeError && state && !isTranscribing && (
          <div className="flex flex-wrap items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3 animate-fade-in">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-rose-800">Falha na transcrição</p>
                <p className="text-xs text-rose-600">{transcribeError}</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTranscribe}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Tentar novamente
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOpts((v) => !v)}
              leftIcon={<Settings2 className="h-4 w-4" />}
              rightIcon={showOpts ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            >
              {showOpts ? 'Ocultar opções' : 'Opções da IA'}
            </Button>
            {config && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500 shadow-soft">
                <Sparkles className="h-3 w-3 text-brand-400" />
                {MODELS.find((m) => m.value === config.model)?.label ?? config.model}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleTranscribe}
              loading={isTranscribing}
              disabled={!state || !isOnline}
              leftIcon={isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            >
              {isTranscribing ? 'Processando…' : 'Processar áudio'}
            </Button>

            {isTranscribing && (
              <Button
                variant="danger"
                size="md"
                onClick={cancelTranscription}
                leftIcon={<Square className="h-4 w-4" />}
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {showOpts && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 animate-fade-in">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Parâmetros de transcrição
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Idioma"
                htmlFor="opt-language"
                hint="Especificar o idioma melhora a precisão. Use 'Detectar automaticamente' quando não souber."
              >
                <div className="relative">
                  <Languages className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Select
                    id="opt-language"
                    value={transcribeOpts.language}
                    onChange={(e) => setTranscribeOpts({ language: e.target.value })}
                    options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                    className="pl-9"
                  />
                </div>
              </Field>

              <Field
                label="Beam size"
                hint="Controla quantas hipóteses o modelo avalia ao mesmo tempo. Valor maior = mais lento porém mais preciso."
              >
                <div className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 shrink-0 text-slate-400" />
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    value={transcribeOpts.beam_size}
                    onChange={(e) => setTranscribeOpts({ beam_size: Math.max(1, Math.min(10, Number(e.target.value) || 5)) })}
                    className="h-10 w-24 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-soft focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={transcribeOpts.beam_size}
                    onChange={(e) => setTranscribeOpts({ beam_size: Number(e.target.value) })}
                    className="flex-1 accent-brand-600"
                  />
                </div>
              </Field>
            </div>

            <Slider
              label="Temperatura de amostragem"
              value={transcribeOpts.temperature}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => setTranscribeOpts({ temperature: v })}
              formatValue={(v) => v.toFixed(2)}
              hint="0 = respostas mais determinísticas e fiéis. Valores maiores aumentam a aleatoriedade — útil para criatividade, mas pode gerar erros."
            />

            <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <Brain className="h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800">VAD Filter</p>
                  <p className="text-xs text-slate-500">
                    Detecta e remove trechos silenciosos antes de transcrever. Reduz erros em áudios com muito silêncio ou ruído de fundo.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={transcribeOpts.vad_filter}
                onChange={(e) => setTranscribeOpts({ vad_filter: e.target.checked })}
                className="h-5 w-5 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
            </label>
          </div>
        )}

        {transcription && (
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Resultado
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                leftIcon={
                  copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />
                }
              >
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
              {transcription}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
