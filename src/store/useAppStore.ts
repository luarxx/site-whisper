import { create } from 'zustand';
import { getApiClient } from '@/services/api';
import type { LogLine, WhisperConfig } from '@/types';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppState {
  apiBaseUrl: string;
  isOnline: boolean;
  isConnecting: boolean;
  transcription: string;
  isTranscribing: boolean;
  toasts: Toast[];
  config: WhisperConfig | null;
  configDraft: WhisperConfig | null;
  logs: LogLine[];
  isLoadingLogs: boolean;

  setApiBaseUrl: (url: string) => void;
  checkConnection: () => Promise<void>;
  setTranscription: (text: string) => void;
  setTranscribing: (loading: boolean) => void;
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  refreshConfig: () => Promise<void>;
  updateConfigDraft: (patch: Partial<WhisperConfig>) => void;
  saveConfig: () => Promise<void>;
  refreshLogs: () => Promise<void>;
}

let toastIdCounter = 0;

export const useAppStore = create<AppState>()((set, get) => ({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  isOnline: false,
  isConnecting: false,
  transcription: '',
  isTranscribing: false,
  toasts: [],
  config: null,
  configDraft: null,
  logs: [],
  isLoadingLogs: false,

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
      const config = await client.getConfig();
      set({ config, configDraft: structuredClone(config) });
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
    await client.saveConfig(configDraft);
    set({ config: structuredClone(configDraft) });
    get().pushToast({ type: 'success', message: 'Configuração salva. Modelo reiniciando.' });
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
}));
