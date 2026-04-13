import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { UserError } from '@missionsquad/fastmcp';
import { z } from 'zod';

dotenv.config();

const DEFAULT_API_URL = 'https://api.mindbodyonline.com/public/v6';

const EnvSchema = z.object({
  MINDBODY_API_KEY: z.string().optional(),
  MINDBODY_SITE_ID: z.string().optional(),
  MINDBODY_SOURCE_NAME: z.string().optional(),
  MINDBODY_SOURCE_PASSWORD: z.string().optional(),
  MINDBODY_API_URL: z.string().optional(),
});

const env = EnvSchema.parse(process.env);

export const MINDBODY_SECRET_NAMES = [
  'apiKey',
  'siteId',
  'sourceName',
  'sourcePassword',
  'apiUrl',
] as const;

export const MINDBODY_SECRET_FIELDS = [
  {
    name: 'apiKey',
    label: 'Mindbody API key',
    description: 'Mindbody public API key for the target site.',
    required: true,
    inputType: 'password' as const,
  },
  {
    name: 'siteId',
    label: 'Mindbody site ID',
    description: 'Mindbody site ID for the execution target, for example -99 for sandbox.',
    required: true,
    inputType: 'password' as const,
  },
  {
    name: 'sourceName',
    label: 'Mindbody source username',
    description: 'Optional source credential username for bearer-token issuance. Provide with sourcePassword.',
    required: false,
    inputType: 'password' as const,
  },
  {
    name: 'sourcePassword',
    label: 'Mindbody source password',
    description: 'Optional source credential password for bearer-token issuance. Provide with sourceName.',
    required: false,
    inputType: 'password' as const,
  },
  {
    name: 'apiUrl',
    label: 'Mindbody API base URL',
    description: 'Optional override for the Mindbody API base URL. Defaults to the public v6 endpoint.',
    required: false,
    inputType: 'password' as const,
  },
] as const;

export interface AppConfig {
  defaultApiKey: string | undefined;
  defaultSiteId: string | undefined;
  defaultSourceName: string | undefined;
  defaultSourcePassword: string | undefined;
  defaultApiUrl: string;
}

export interface ResolvedMindbodyConfig {
  apiKey: string;
  siteId: string;
  sourceName?: string;
  sourcePassword?: string;
  apiUrl: string;
  cacheScopeKey: string;
}

export const appConfig: AppConfig = {
  defaultApiKey: env.MINDBODY_API_KEY?.trim() || undefined,
  defaultSiteId: env.MINDBODY_SITE_ID?.trim() || undefined,
  defaultSourceName: env.MINDBODY_SOURCE_NAME?.trim() || undefined,
  defaultSourcePassword: env.MINDBODY_SOURCE_PASSWORD?.trim() || undefined,
  defaultApiUrl: env.MINDBODY_API_URL?.trim() || DEFAULT_API_URL,
};

function readHiddenString(
  extraArgs: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = extraArgs?.[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new UserError(`Hidden argument "${key}" must be a string when provided.`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new UserError(`Hidden argument "${key}" must be a non-empty string when provided.`);
  }

  return trimmed;
}

function buildCacheScopeKey(parts: readonly string[]): string {
  const hash = createHash('sha256');

  for (const part of parts) {
    hash.update(part);
    hash.update('\0');
  }

  return hash.digest('hex').slice(0, 16);
}

export function resolveMindbodyConfig(
  extraArgs: Record<string, unknown> | undefined,
  defaults: AppConfig = appConfig,
): ResolvedMindbodyConfig {
  const apiKey = readHiddenString(extraArgs, 'apiKey') ?? defaults.defaultApiKey;
  const siteId = readHiddenString(extraArgs, 'siteId') ?? defaults.defaultSiteId;
  const sourceName = readHiddenString(extraArgs, 'sourceName') ?? defaults.defaultSourceName;
  const sourcePassword =
    readHiddenString(extraArgs, 'sourcePassword') ?? defaults.defaultSourcePassword;
  const apiUrl = readHiddenString(extraArgs, 'apiUrl') ?? defaults.defaultApiUrl;

  if (apiKey === undefined || apiKey.length === 0) {
    throw new UserError(
      'Mindbody authentication is required. Provide hidden argument "apiKey" or set MINDBODY_API_KEY for local standalone use.',
    );
  }

  if (siteId === undefined || siteId.length === 0) {
    throw new UserError(
      'Mindbody site ID is required. Provide hidden argument "siteId" or set MINDBODY_SITE_ID for local standalone use.',
    );
  }

  const hasSourceName = sourceName !== undefined && sourceName.length > 0;
  const hasSourcePassword = sourcePassword !== undefined && sourcePassword.length > 0;

  if (hasSourceName !== hasSourcePassword) {
    throw new UserError(
      'Mindbody source credentials must include both "sourceName" and "sourcePassword" together when provided.',
    );
  }

  return {
    apiKey,
    siteId,
    sourceName: hasSourceName ? sourceName : undefined,
    sourcePassword: hasSourcePassword ? sourcePassword : undefined,
    apiUrl,
    cacheScopeKey: buildCacheScopeKey([
      apiUrl,
      siteId,
      apiKey,
      sourceName ?? '',
      sourcePassword ?? '',
    ]),
  };
}
