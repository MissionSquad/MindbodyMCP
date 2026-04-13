import test from 'node:test';
import assert from 'node:assert/strict';
import { classCache } from '../dist/cache/index.js';
import {
  MINDBODY_SECRET_NAMES,
  resolveMindbodyConfig,
} from '../dist/config.js';
import { withMindbodyExecution } from '../dist/runtime.js';
import { mindbodyToolDefinitions } from '../dist/toolDefinitions.js';

const defaults = {
  defaultApiKey: 'env-api-key',
  defaultSiteId: '-99',
  defaultSourceName: 'env-source-user',
  defaultSourcePassword: 'env-source-password',
  defaultApiUrl: 'https://env.example.com/public/v6',
};

test('hidden values override env fallback', () => {
  const config = resolveMindbodyConfig(
    {
      apiKey: 'hidden-api-key',
      siteId: '123',
      sourceName: 'hidden-user',
      sourcePassword: 'hidden-password',
      apiUrl: 'https://hidden.example.com/public/v6',
    },
    defaults,
  );

  assert.equal(config.apiKey, 'hidden-api-key');
  assert.equal(config.siteId, '123');
  assert.equal(config.sourceName, 'hidden-user');
  assert.equal(config.sourcePassword, 'hidden-password');
  assert.equal(config.apiUrl, 'https://hidden.example.com/public/v6');
});

test('env fallback works when hidden values are absent', () => {
  const config = resolveMindbodyConfig(undefined, defaults);

  assert.equal(config.apiKey, defaults.defaultApiKey);
  assert.equal(config.siteId, defaults.defaultSiteId);
  assert.equal(config.sourceName, defaults.defaultSourceName);
  assert.equal(config.sourcePassword, defaults.defaultSourcePassword);
  assert.equal(config.apiUrl, defaults.defaultApiUrl);
});

test('missing required auth values fail with user-facing errors', () => {
  assert.throws(
    () =>
      resolveMindbodyConfig(
        {
          siteId: '123',
        },
        {
          ...defaults,
          defaultApiKey: undefined,
        },
      ),
    /apiKey/,
  );

  assert.throws(
    () =>
      resolveMindbodyConfig(
        {
          apiKey: 'hidden-api-key',
        },
        {
          ...defaults,
          defaultSiteId: undefined,
        },
      ),
    /siteId/,
  );
});

test('wrong hidden types fail with user-facing errors', () => {
  assert.throws(
    () =>
      resolveMindbodyConfig(
        {
          apiKey: 123,
          siteId: '123',
        },
        defaults,
      ),
    /apiKey/,
  );
});

test('empty hidden strings fail with user-facing errors', () => {
  assert.throws(
    () =>
      resolveMindbodyConfig(
        {
          apiKey: '   ',
          siteId: '123',
        },
        defaults,
      ),
    /non-empty string/,
  );
});

test('source credentials must be provided together', () => {
  assert.throws(
    () =>
      resolveMindbodyConfig(
        {
          apiKey: 'hidden-api-key',
          siteId: '123',
          sourceName: 'only-name',
        },
        {
          ...defaults,
          defaultSourceName: undefined,
          defaultSourcePassword: undefined,
        },
      ),
    /sourceName.*sourcePassword/,
  );
});

test('tool schemas do not expose hidden secret keys', () => {
  const hiddenKeys = new Set(MINDBODY_SECRET_NAMES);

  function assertSchemaSafe(schema) {
    if (!schema || typeof schema !== 'object') {
      return;
    }

    if ('properties' in schema && schema.properties && typeof schema.properties === 'object') {
      for (const [key, value] of Object.entries(schema.properties)) {
        assert.equal(
          hiddenKeys.has(key),
          false,
          `Tool schema must not expose hidden key "${key}"`,
        );
        assertSchemaSafe(value);
      }
    }

    if ('items' in schema) {
      assertSchemaSafe(schema.items);
    }
  }

  for (const tool of mindbodyToolDefinitions) {
    assertSchemaSafe(tool.inputSchema);
  }
});

test('cache entries are isolated per execution target', async () => {
  await withMindbodyExecution(
    {
      apiKey: 'api-key-a',
      siteId: 'site-a',
    },
    async () => {
      classCache.set('shared-key', 'value-a');
      assert.equal(classCache.get('shared-key'), 'value-a');
    },
  );

  await withMindbodyExecution(
    {
      apiKey: 'api-key-b',
      siteId: 'site-b',
    },
    async () => {
      assert.equal(classCache.get('shared-key'), null);
      classCache.set('shared-key', 'value-b');
      assert.equal(classCache.get('shared-key'), 'value-b');
      classCache.clear();
      assert.equal(classCache.get('shared-key'), null);
    },
  );

  await withMindbodyExecution(
    {
      apiKey: 'api-key-a',
      siteId: 'site-a',
    },
    async () => {
      assert.equal(classCache.get('shared-key'), 'value-a');
      classCache.clear();
      assert.equal(classCache.get('shared-key'), null);
    },
  );
});
