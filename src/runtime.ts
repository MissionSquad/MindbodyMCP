import { AsyncLocalStorage } from 'node:async_hooks';
import { createMindbodyApiClient, type MindbodyApiClient } from './api/client.js';
import {
  appConfig,
  resolveMindbodyConfig,
  type AppConfig,
  type ResolvedMindbodyConfig,
} from './config.js';

export interface MindbodyExecutionContext {
  client: MindbodyApiClient;
  config: ResolvedMindbodyConfig;
  cacheScopeKey: string;
}

const executionStorage = new AsyncLocalStorage<MindbodyExecutionContext>();

function createExecutionContext(
  extraArgs: Record<string, unknown> | undefined,
  defaults: AppConfig = appConfig,
): MindbodyExecutionContext {
  const config = resolveMindbodyConfig(extraArgs, defaults);

  return {
    client: createMindbodyApiClient(config),
    config,
    cacheScopeKey: config.cacheScopeKey,
  };
}

export async function withMindbodyExecution<T>(
  extraArgs: Record<string, unknown> | undefined,
  run: () => Promise<T>,
): Promise<T> {
  const context = createExecutionContext(extraArgs);
  return executionStorage.run(context, run);
}

export function getMindbodyExecutionContext(): MindbodyExecutionContext {
  return executionStorage.getStore() ?? createExecutionContext(undefined);
}
