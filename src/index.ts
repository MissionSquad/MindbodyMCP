#!/usr/bin/env node
import { FastMCP } from '@missionsquad/fastmcp';
import { registerMindbodyTools } from './toolDefinitions.js';

type TransportConfig =
  | { transport: 'stdio' }
  | { transport: 'sse'; port: number };

function parseArgs(): TransportConfig {
  const args = process.argv.slice(2);
  let transport: 'stdio' | 'sse' = 'stdio';
  let port = Number.parseInt(process.env.MCP_PORT ?? '3000', 10);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if ((arg === '--transport' || arg === '-t') && args[index + 1]) {
      const value = args[index + 1];
      if (value === 'stdio' || value === 'sse') {
        transport = value;
      }
      index += 1;
      continue;
    }

    if ((arg === '--port' || arg === '-p') && args[index + 1]) {
      port = Number.parseInt(args[index + 1], 10);
      index += 1;
      continue;
    }

    if (arg === '--host' || arg === '--ssl-cert' || arg === '--ssl-key') {
      console.error(
        `Ignoring unsupported FastMCP runtime flag "${arg}". MissionSquad compatibility only requires stdio and basic SSE port configuration.`,
      );
      index += 1;
    }
  }

  if (transport === 'sse') {
    return {
      transport,
      port: Number.isFinite(port) ? port : 3000,
    };
  }

  return { transport };
}

const server = new FastMCP<undefined>({
  name: process.env.MCP_SERVER_NAME?.trim() || 'mcp-mindbody',
  version: (process.env.MCP_SERVER_VERSION?.trim() || '2.0.2') as `${number}.${number}.${number}`,
});

registerMindbodyTools(server);

async function main(): Promise<void> {
  const config = parseArgs();

  if (config.transport === 'sse') {
    console.error(`Starting Mindbody MCP server in SSE mode on port ${config.port}`);
    await server.start({
      transportType: 'sse',
      sse: {
        endpoint: '/sse',
        port: config.port,
      },
    });
    return;
  }

  console.error('Starting Mindbody MCP server in STDIO mode');
  await server.start({ transportType: 'stdio' });
}

async function shutdown(exitCode: number): Promise<void> {
  try {
    await server.stop();
  } finally {
    process.exit(exitCode);
  }
}

process.on('SIGINT', () => {
  void shutdown(0);
});

process.on('SIGTERM', () => {
  void shutdown(0);
});

process.on('uncaughtException', (error) => {
  console.error(error);
  void shutdown(1);
});

process.on('unhandledRejection', (error) => {
  console.error(error);
  void shutdown(1);
});

void main().catch((error) => {
  console.error(error);
  void shutdown(1);
});
