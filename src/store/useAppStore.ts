import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getApiClient } from '@/services/api';
import type { LogLine, WhisperConfig, WhatsAppConfig, WhatsAppState } from '@/types';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface TranscribeOptions {
  language: string;
  temperature: number;
  beam_size: number;
  vad_filter: boolean;
}

interface AppState {
  apiBaseUrl: string;
  isOnline: boolean;
  isConnecting: boolean;
  transcription: string;
  transcribeError: string | null;
  isTranscribing: boolean;
  transcriptionFile: string | null;
  toasts: Toast[];
  config: WhisperConfig | null;
  configDraft: WhisperConfig | null;
  logs: LogLine[];
  isLoadingLogs: boolean;
  abortController: AbortController | null;

  transcribeOpts: TranscribeOptions;

  whatsAppConfig: WhatsAppConfig;
  whatsAppState: WhatsAppState;
  whatsAppQrCode: string | null;
  whatsAppError: string | null;

  setApiBaseUrl: (url: string) => void;
  setTranscribeOpts: (patch: Partial<TranscribeOptions>) => void;
  checkConnection: () => Promise<void>;
  setTranscription: (text: string) => void;
  setTranscribing: (loading: boolean) => void;
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  refreshConfig: () => Promise<void>;
  updateConfigDraft: (patch: Partial<WhisperConfig>) => void;
  saveConfig: () => Promise<void>;
  refreshLogs: () => Promise<void>;
  startTranscription: (file: File, opts: TranscribeOptions) => Promise<void>;
  cancelTranscription: () => void;
  createWhatsAppInstance: () => Promise<void>;
  checkWhatsAppStatus: () => Promise<void>;
  disconnectWhatsApp: () => Promise<void>;
  setWhatsAppConfig: (patch: Partial<WhatsAppConfig>) => void;
}

let toastIdCounter = 0;

const DEFAULT_OPTS: TranscribeOptions = {
  language: 'auto',
  temperature: 0,
  beam_size: 5,
  vad_filter: true,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
      isOnline: false,
      isConnecting: false,
      transcription: '',
      transcribeError: null,
      isTranscribing: false,
      transcriptionFile: null,
      abortController: null,
      transcribeOpts: { ...DEFAULT_OPTS },
      toasts: [],
      config: null,
      configDraft: null,
      logs: [],
      isLoadingLogs: false,

      whatsAppConfig: {
        evolutionApiUrl: 'http://localhost:8080',
        apiKey: '',
      },
      whatsAppState: 'idle',
      whatsAppQrCode: null,
      whatsAppError: null,

      setTranscribeOpts: (patch) => {
        set((state) => ({ transcribeOpts: { ...state.transcribeOpts, ...patch } }));
      },

      /**
       * Define a URL base da API e reconfigura o cliente HTTP.
       * @param url - URL do endpoint (ex: http://localhost:8000)
       */
      setApiBaseUrl: (url) => {
        console.log(`[Store] setApiBaseUrl -> "${url}"`);
        set({ apiBaseUrl: url });
        getApiClient(url);
      },

  /**
   * Testa a conectividade com a API (sem parâmetros).
   * Atualiza isOnline e isConnecting automaticamente.
   */
  checkConnection: async () => {
    const { apiBaseUrl } = get();
    console.log(`[Store] checkConnection — testando "${apiBaseUrl}"`);
    const client = getApiClient(apiBaseUrl);
    set({ isConnecting: true });
    try {
      const ok = await client.health();
      if (ok) {
        console.log('[Store] Servidor online');
        set({ isOnline: true, isConnecting: false });
      } else {
        console.warn('[Store] Servidor não respondeu');
        set({ isOnline: false, isConnecting: false });
      }
    } catch (err) {
      console.warn('[Store] checkConnection falhou:', err);
      set({ isOnline: false, isConnecting: false });
    }
  },

  /**
   * Define o texto da transcrição no estado global.
   * @param text - Texto transcrito
   */
  setTranscription: (text) => set({ transcription: text }),
  /**
   * Define o estado de carregamento da transcrição.
   * @param loading - true enquanto estiver transcrevendo
   */
  setTranscribing: (loading) => set({ isTranscribing: loading }),

  /**
   * Adiciona uma notificação toast à lista.
   * @param toast.type - Tipo: "success" | "error" | "info"
   * @param toast.message - Mensagem exibida no toast
   */
  pushToast: (toast) => {
    const id = ++toastIdCounter;
    set((state) => ({ toasts: [...state.toasts, { id, ...toast }] }));
    setTimeout(() => get().dismissToast(id), 4500);
  },

  /**
   * Remove um toast da lista pelo ID.
   * @param id - ID numérico do toast
   */
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  refreshConfig: async () => {
    const { apiBaseUrl } = get();
    const client = getApiClient(apiBaseUrl);
    try {
      const newConfig = await client.getConfig();
      const { config, configDraft } = get();
      const hasLocalEdits = configDraft && config && JSON.stringify(configDraft) !== JSON.stringify(config);
      if (hasLocalEdits) {
        set({ config: newConfig });
      } else {
        set({ config: newConfig, configDraft: structuredClone(newConfig) });
      }
    } catch {
      console.warn('[Store] refreshConfig falhou');
    }
  },

  updateConfigDraft: (patch) => {
    set((state) => ({
      configDraft: state.configDraft ? { ...state.configDraft, ...patch } : null,
    }));
  },

  saveConfig: async () => {
    const { apiBaseUrl, configDraft } = get();
    if (!configDraft) return;
    const client = getApiClient(apiBaseUrl);
    try {
      await client.saveConfig(configDraft);
      set({ config: structuredClone(configDraft) });
      get().pushToast({ type: 'success', message: 'Configuração salva. Modelo reiniciando.' });
    } catch (err) {
      console.error('[Store] saveConfig falhou:', err);
      get().pushToast({ type: 'error', message: 'Falha ao salvar configuração. Verifique a conexão com a API.' });
      throw err;
    }
  },

  refreshLogs: async () => {
    const { apiBaseUrl, pushToast } = get();
    const client = getApiClient(apiBaseUrl);
    set({ isLoadingLogs: true });
    try {
      const logs = await client.getLogs();
      set({ logs });
    } catch (err) {
      console.error('[Store] refreshLogs falhou:', err);
      pushToast({ type: 'error', message: 'Falha ao carregar logs. Verifique se a API está disponível.' });
    } finally {
      set({ isLoadingLogs: false });
    }
  },

  startTranscription: async (file, opts) => {
    const { apiBaseUrl } = get();
    const client = getApiClient(apiBaseUrl);
    const controller = new AbortController();
    set({
      isTranscribing: true,
      transcription: '',
      transcribeError: null,
      transcriptionFile: file.name,
      abortController: controller,
    });
    try {
      const result = await client.transcribe(file, {
        language: opts.language === 'auto' ? undefined : opts.language,
        temperature: opts.temperature,
        beam_size: opts.beam_size,
        vad_filter: opts.vad_filter,
        signal: controller.signal,
      });
      set({ transcription: result.text });
      get().pushToast({ type: 'success', message: 'Transcrição concluída.' });
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = client.extractErrorMessage(err);
      set({ transcribeError: msg });
      get().pushToast({ type: 'error', message: msg });
    } finally {
      set({ isTranscribing: false, abortController: null });
    }
  },

  cancelTranscription: () => {
    const { abortController } = get();
    abortController?.abort();
    set({ isTranscribing: false, abortController: null });
    get().pushToast({ type: 'info', message: 'Transcrição cancelada.' });
  },

  setWhatsAppConfig: (patch) => {
    set((state) => ({ whatsAppConfig: { ...state.whatsAppConfig, ...patch } }));
  },

  createWhatsAppInstance: async () => {
    const { apiBaseUrl, whatsAppConfig } = get();
    const client = getApiClient(apiBaseUrl);
    set({ whatsAppState: 'connecting', whatsAppQrCode: null, whatsAppError: null });
    try {
      const data = await client.createWhatsAppInstance(whatsAppConfig);
      set({
        whatsAppState: data.state,
        whatsAppQrCode: data.qrcode ?? null,
      });
      get().pushToast({ type: 'info', message: 'Instância criada. Escaneie o QR Code com seu WhatsApp.' });
    } catch (err) {
      const msg = client.extractErrorMessage(err);
      console.error('[Store] createWhatsAppInstance falhou:', err);
      set({ whatsAppState: 'error', whatsAppError: msg });
      get().pushToast({ type: 'error', message: `Falha ao conectar WhatsApp: ${msg}` });
    }
  },

  checkWhatsAppStatus: async () => {
    const { apiBaseUrl } = get();
    const client = getApiClient(apiBaseUrl);
    try {
      const data = await client.getWhatsAppStatus();
      set({
        whatsAppState: data.state,
        whatsAppError: data.state === 'error' ? 'Conexão perdida' : null,
      });
    } catch {
      set({ whatsAppState: 'idle', whatsAppQrCode: null });
    }
  },

  disconnectWhatsApp: async () => {
    const { apiBaseUrl } = get();
    const client = getApiClient(apiBaseUrl);
    try {
      await client.disconnectWhatsApp();
      set({
        whatsAppState: 'idle',
        whatsAppQrCode: null,
        whatsAppError: null,
      });
      get().pushToast({ type: 'info', message: 'WhatsApp desconectado.' });
    } catch (err) {
      const msg = client.extractErrorMessage(err);
      set({ whatsAppError: msg });
      get().pushToast({ type: 'error', message: `Falha ao desconectar: ${msg}` });
    }
  },
}),
    {
      name: 'whisper-store',
      partialize: (state) => ({
        apiBaseUrl: state.apiBaseUrl,
        transcribeOpts: state.transcribeOpts,
        config: state.config,
        whatsAppConfig: state.whatsAppConfig,
      }),
    },
  ),
);
