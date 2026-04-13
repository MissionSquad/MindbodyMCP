import { getMindbodyExecutionContext } from '../runtime.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: Date;
}

export class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number;
  private namespace: string;

  constructor(namespace: string, defaultTTLMinutes: number = 5) {
    this.namespace = namespace;
    this.defaultTTL = defaultTTLMinutes * 60 * 1000; // Convert to milliseconds
  }

  private getScopedKey(key: string): string {
    const { cacheScopeKey } = getMindbodyExecutionContext();
    return `${this.namespace}:${cacheScopeKey}:${key}`;
  }

  set<T>(key: string, value: T, ttlMinutes?: number): void {
    const ttl = ttlMinutes ? ttlMinutes * 60 * 1000 : this.defaultTTL;
    const expiresAt = new Date(Date.now() + ttl);
    
    this.cache.set(this.getScopedKey(key), {
      data: value,
      expiresAt,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(this.getScopedKey(key));
    
    if (!entry) {
      return null;
    }

    if (entry.expiresAt < new Date()) {
      this.cache.delete(this.getScopedKey(key));
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    const prefix = `${this.namespace}:${getMindbodyExecutionContext().cacheScopeKey}:`;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  delete(key: string): void {
    this.cache.delete(this.getScopedKey(key));
  }

  // Clean up expired entries
  cleanup(): void {
    const now = new Date();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
}

// Create singleton instances for different cache purposes
export const teacherCache = new SimpleCache('teacher', 60); // 1 hour for teacher data
export const classCache = new SimpleCache('class', 5); // 5 minutes for class data
export const generalCache = new SimpleCache('general', 10); // 10 minutes for general data

// Run cleanup every 5 minutes
const cleanupTimer = setInterval(() => {
  teacherCache.cleanup();
  classCache.cleanup();
  generalCache.cleanup();
}, 5 * 60 * 1000);

cleanupTimer.unref();
