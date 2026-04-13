import axios, {
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
} from 'axios';
import { getMindbodyAuthSession } from './auth.js';
import type { ResolvedMindbodyConfig } from '../config.js';

export class MindbodyApiClient {
  private readonly client: AxiosInstance;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(private readonly config: ResolvedMindbodyConfig) {
    const authSession = getMindbodyAuthSession(config);

    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
    });

    this.client.interceptors.request.use(async (requestConfig) => {
      const headers = await authSession.getAuthHeaders();
      const requestHeaders = AxiosHeaders.from(requestConfig.headers ?? {});
      requestHeaders.set(headers);
      requestConfig.headers = requestHeaders;
      return requestConfig;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && !error.config?._retried) {
          error.config._retried = true;
          authSession.resetTokenState();

          const headers = await authSession.getAuthHeaders();
          const retryHeaders = AxiosHeaders.from(error.config.headers ?? {});
          retryHeaders.set(headers);
          error.config.headers = retryHeaders;

          return this.client.request(error.config);
        }

        throw error;
      },
    );
  }

  async request<T>(config: AxiosRequestConfig, retries = 0): Promise<T> {
    try {
      const response = await this.client.request<T>(config);
      return response.data;
    } catch (error: any) {
      if (retries < this.maxRetries && this.shouldRetry(error)) {
        await this.delay(this.retryDelay * Math.pow(2, retries));
        return this.request<T>(config, retries + 1);
      }

      throw this.formatError(error);
    }
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  private shouldRetry(error: any): boolean {
    if (!error.response) {
      return true;
    }

    return error.response.status >= 500;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private formatError(error: any): Error {
    if (error.response?.data?.Error) {
      const mbError = error.response.data.Error;
      return new Error(`Mindbody API Error: ${mbError.Message} (Code: ${mbError.Code})`);
    }

    if (error.response) {
      const status = error.response.status;
      const statusText = error.response.statusText;

      if (status === 401 || status === 403) {
        return new Error(
          `Mindbody auth error (${status}): ${statusText}. ` +
            `Check that the configured apiKey is valid and activated for site ${this.config.siteId}. ` +
            `If using source credentials, verify sourceName and sourcePassword are correct for that site.`,
        );
      }

      return new Error(`Mindbody API error: ${status} - ${statusText}`);
    }

    return new Error(`Mindbody network error: ${error.message}`);
  }
}

const clientCache = new Map<string, MindbodyApiClient>();

export function createMindbodyApiClient(config: ResolvedMindbodyConfig): MindbodyApiClient {
  const cached = clientCache.get(config.cacheScopeKey);
  if (cached) {
    return cached;
  }

  const client = new MindbodyApiClient(config);
  clientCache.set(config.cacheScopeKey, client);
  return client;
}
