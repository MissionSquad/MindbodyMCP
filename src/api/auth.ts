import axios from 'axios';
import type { ResolvedMindbodyConfig } from '../config.js';

interface TokenResponse {
  TokenType: string;
  AccessToken: string;
  ExpiresIn: number;
}

interface UserToken {
  token: string;
  expiresAt: Date;
}

export class MindbodyAuthSession {
  private userToken: UserToken | null = null;
  private tokenFailed = false;

  constructor(private readonly config: ResolvedMindbodyConfig) {}

  private hasSourceCredentials(): boolean {
    return Boolean(this.config.sourceName && this.config.sourcePassword);
  }

  async getUserToken(): Promise<string | null> {
    if (!this.hasSourceCredentials()) {
      return null;
    }

    if (this.tokenFailed) {
      return null;
    }

    if (this.userToken && this.userToken.expiresAt > new Date()) {
      return this.userToken.token;
    }

    try {
      const response = await axios.post<TokenResponse>(
        `${this.config.apiUrl}/usertoken/issue`,
        {
          Username: this.config.sourceName,
          Password: this.config.sourcePassword,
        },
        {
          headers: {
            'Api-Key': this.config.apiKey,
            SiteId: this.config.siteId,
            'Content-Type': 'application/json',
          },
        },
      );

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + response.data.ExpiresIn - 60);

      this.userToken = {
        token: response.data.AccessToken,
        expiresAt,
      };

      this.tokenFailed = false;
      return this.userToken.token;
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.Error?.Message || error.message;
      console.error(
        `Mindbody user token acquisition failed (${status ?? 'unknown'}): ${message}. Falling back to API-key-only auth.`,
      );
      this.tokenFailed = true;
      return null;
    }
  }

  resetTokenState(): void {
    this.tokenFailed = false;
    this.userToken = null;
  }

  getHeaders(): Record<string, string> {
    return {
      'Api-Key': this.config.apiKey,
      SiteId: this.config.siteId,
      'Content-Type': 'application/json',
    };
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const headers = this.getHeaders();
    const token = await this.getUserToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }
}

const authSessionCache = new Map<string, MindbodyAuthSession>();

export function getMindbodyAuthSession(config: ResolvedMindbodyConfig): MindbodyAuthSession {
  const cached = authSessionCache.get(config.cacheScopeKey);
  if (cached) {
    return cached;
  }

  const session = new MindbodyAuthSession(config);
  authSessionCache.set(config.cacheScopeKey, session);
  return session;
}
