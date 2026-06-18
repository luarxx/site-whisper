import axios, { AxiosError, type AxiosInstance } from 'axios';
import type { LogLine, TranscribeResponse, WhisperConfig, WhatsAppConfig, WhatsAppInstanceData, WhatsAppStatusResponse } from '@/types';

export class ApiClient {
  private instance: AxiosInstance;

  /**
   * @param baseURL - URL base da API (ex: http://localhost:8000)
   */
  constructor(baseURL: string) {
    const normalized = this.normalize(baseURL);
    console.log(`[API] Criando instância com baseURL: "${normalized}"`);

    this.instance = axios.create({
      baseURL: normalized,
      timeout: 120_000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.instance.interceptors.request.use((config) => {
      console.log(
        `[API] ➡️  ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
        config.params ? { params: config.params } : '',
        config.data instanceof FormData ? '(multipart/form-data)' : config.data
      );
      return config;
    });

    this.instance.interceptors.response.use(
      (response) => {
        console.log(`[API] ✅ ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error: AxiosError) => {
        const method = error.config?.method?.toUpperCase() ?? '???';
        const url = error.config?.url ?? '???';
        const status = error.response?.status ?? 'SEM RESPOSTA';
        const statusText = error.response?.statusText ?? '';
        const responseData = error.response?.data;

        console.group(`[API] ❌ ${method} ${url} — ${status} ${statusText}`);
        console.error('Código do erro:', error.code);
        console.error('Mensagem:', error.message);
        if (responseData) {
          console.error('Resposta do servidor:', responseData);
        }
        if (error.code === 'ERR_NETWORK') {
          console.error('Conexão recusada — verifique se o servidor está rodando e o URL está correto.');
        }
        console.groupEnd();

        return Promise.reject(error);
      }
    );
  }

  /**
   * Atualiza a URL base da instância.
   * @param baseURL - Nova URL base
   */
  setBaseURL(baseURL: string): void {
    const normalized = this.normalize(baseURL);
    console.log(`[API] Atualizando baseURL para: "${normalized}"`);
    this.instance.defaults.baseURL = normalized;
  }

  getBaseURL(): string {
    return this.instance.defaults.baseURL ?? '';
  }

  /**
   * Remove a barra final da URL.
   * @param url - URL para normalizar
   */
  private normalize(url: string): string {
    return url.replace(/\/+$/, '');
  }

  /**
   * Verifica se o servidor está online.
   * Tenta /health primeiro; se 404, usa /docs como fallback.
   */
  async health(): Promise<boolean> {
    for (const endpoint of ['/health', '/docs']) {
      console.log(`[API] Verificando conectividade em ${endpoint}...`);
      try {
        await this.instance.get(endpoint, { timeout: 8_000 });
        console.log(`[API] Servidor online (${endpoint} respondeu)`);
        return true;
      } catch {
        console.warn(`[API] ${endpoint} indisponível`);
      }
    }
    console.warn('[API] Servidor offline ou inacessível');
    return false;
  }

  /**
   * Envia um arquivo de áudio para transcrição.
   * @param file - Arquivo de áudio (File)
   * @param options.language - Código do idioma (ex: "pt", "auto")
   * @param options.temperature - Temperatura de amostragem (0 a 1)
   * @param options.response_format - Formato da resposta (ex: "json", "text")
   * @param options.beam_size - Número de beams no beam search (1 a 10)
   * @param options.vad_filter - Ativa filtro de silêncio (booleano)
   */
  async transcribe(
    file: File,
    options?: {
      language?: string;
      temperature?: number;
      response_format?: string;
      beam_size?: number;
      vad_filter?: boolean;
      signal?: AbortSignal;
    }
  ): Promise<TranscribeResponse> {
    const form = new FormData();
    form.append('file', file);
    if (options?.language && options.language !== 'auto') form.append('language', options.language);
    if (options?.temperature !== undefined) {
      form.append('temperature', String(options.temperature));
    }
    if (options?.response_format) form.append('response_format', options.response_format);
    if (options?.beam_size !== undefined) {
      form.append('beam_size', String(options.beam_size));
    }
    if (options?.vad_filter !== undefined) {
      form.append('vad_filter', String(options.vad_filter));
    }

    console.log(
      '[API] transcribe iniciado:',
      `file="${file.name}" (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
      options
    );

    const { data } = await this.instance.post<TranscribeResponse>(
      '/v1/audio/transcriptions',
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
        signal: options?.signal,
      }
    );

    console.log('[API] transcribe concluído:', data);
    return data;
  }

  /**
   * Extrai mensagem de erro legível a partir de exceções.
   * @param error - Erro capturado (AxiosError, Error, ou desconhecido)
   */
  extractErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      const data = error.response?.data as { detail?: string } | undefined;
      if (data?.detail) return data.detail;
      if (error.code === 'ERR_NETWORK') return 'Não foi possível conectar à API.';
      return error.message;
    }
    if (error instanceof Error) return error.message;
    return 'Erro desconhecido.';
  }

  /**
   * Busca a configuração atual do modelo no servidor.
   * Retorna null se o endpoint não existir (404).
   */
  async getConfig(): Promise<WhisperConfig | null> {
    try {
      const { data } = await this.instance.get<WhisperConfig>('/config');
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Salva nova configuração e reinicia o modelo.
   * @param config - Configuração completa do Whisper
   */
  async saveConfig(config: WhisperConfig): Promise<void> {
    await this.instance.post('/config', config);
  }

  /**
   * Busca as últimas linhas de log do servidor.
   * Retorna array vazio se o endpoint não existir (404).
   * @param limit - Número máximo de linhas (padrão: 200)
   */
  async getLogs(limit = 200): Promise<LogLine[]> {
    try {
      const { data } = await this.instance.get<{ lines: LogLine[] }>('/logs', {
        params: { limit },
      });
      return data.lines;
    } catch (err) {
      console.error('[API] Falha ao buscar logs:', err);
      throw err;
    }
  }

  /**
   * Cria uma instância na Evolution API e retorna o QR Code.
   * @param config - Configuração da Evolution API (URL e chave)
   */
  async createWhatsAppInstance(config: WhatsAppConfig): Promise<WhatsAppInstanceData> {
    const { data } = await this.instance.post<WhatsAppInstanceData>('/whatsapp/instance', config);
    return data;
  }

  /**
   * Verifica o status da conexão com o WhatsApp.
   */
  async getWhatsAppStatus(): Promise<WhatsAppStatusResponse> {
    const { data } = await this.instance.get<WhatsAppStatusResponse>('/whatsapp/instance');
    return data;
  }

  /**
   * Desconecta a instância do WhatsApp.
   */
  async disconnectWhatsApp(): Promise<void> {
    await this.instance.delete('/whatsapp/instance');
  }
}

let _client: ApiClient | null = null;

/**
 * Retorna (ou cria) a instância singleton do ApiClient.
 * @param baseURL - URL base opcional para reconfigurar o cliente
 */
export function getApiClient(baseURL?: string): ApiClient {
  if (!_client) {
    const envURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
    _client = new ApiClient(baseURL ?? envURL);
  } else if (baseURL) {
    _client.setBaseURL(baseURL);
  }
  return _client;
}
