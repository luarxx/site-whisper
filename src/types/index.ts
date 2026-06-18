export type WhisperModel =
  | 'tiny'
  | 'base'
  | 'small'
  | 'medium'
  | 'large-v2'
  | 'large-v3';

export type Device = 'cuda' | 'cpu';

export type ComputeType = 'float16' | 'int8_float16' | 'int8' | 'float32';

export type LanguageCode = 'auto' | 'pt' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'ja' | 'zh';

export interface WhisperConfig {
  model: WhisperModel;
  device: Device;
  compute_type: ComputeType;
  language: LanguageCode;
  temperature: number;
  beam_size?: number;
  vad_filter?: boolean;
}

export interface ApiStatus {
  online: boolean;
  version: string;
  uptime_seconds: number;
  latency_ms: number;
  resources: {
    cpu_percent: number;
    memory_percent: number;
    gpu_percent: number | null;
    gpu_name: string | null;
  };
  current_config: WhisperConfig;
}

export interface LogLine {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
}

export interface LogResponse {
  lines: LogLine[];
  total: number;
}

export interface TranscribeResponse {
  text: string;
}

export interface ApiError {
  detail: string;
  code?: string;
}

export const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'auto', label: 'Detectar automaticamente' },
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'Inglês' },
  { code: 'es', label: 'Espanhol' },
  { code: 'fr', label: 'Francês' },
  { code: 'de', label: 'Alemão' },
  { code: 'it', label: 'Italiano' },
  { code: 'ja', label: 'Japonês' },
  { code: 'zh', label: 'Chinês' },
];

export const MODELS: { value: WhisperModel; label: string; vram: string }[] = [
  { value: 'tiny', label: 'Tiny', vram: '~1 GB' },
  { value: 'base', label: 'Base', vram: '~1 GB' },
  { value: 'small', label: 'Small', vram: '~2 GB' },
  { value: 'medium', label: 'Medium', vram: '~5 GB' },
  { value: 'large-v2', label: 'Large v2', vram: '~10 GB' },
  { value: 'large-v3', label: 'Large v3', vram: '~10 GB' },
];

export const DEVICES: { value: Device; label: string }[] = [
  { value: 'cuda', label: 'CUDA (GPU)' },
  { value: 'cpu', label: 'CPU' },
];

export const COMPUTE_TYPES: { value: ComputeType; label: string; description: string }[] = [
  { value: 'float16', label: 'float16', description: 'GPU / meia precisão' },
  { value: 'int8_float16', label: 'int8 + float16', description: 'Quantização híbrida' },
  { value: 'int8', label: 'int8', description: 'CPU / quantizado' },
  { value: 'float32', label: 'float32', description: 'Precisão total' },
];
