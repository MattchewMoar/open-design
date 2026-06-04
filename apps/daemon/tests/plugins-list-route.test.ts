import type http from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { InstalledPluginRecord } from '@open-design/contracts';

import { startServer } from '../src/server.js';
import { searchInstalledPlugins } from '../src/plugins/search.js';

type StartedServer = { server: http.Server; url: string; shutdown?: () => Promise<void> | void };

let server: http.Server | undefined;
let shutdown: (() => Promise<void> | void) | undefined;
let baseUrl = '';
let tmpRoot = '';

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'od-plugin-list-route-'));
  const started = await startServer({ port: 0, returnServer: true }) as StartedServer;
  server = started.server;
  shutdown = started.shutdown;
  baseUrl = started.url;
});

afterEach(async () => {
  await Promise.resolve(shutdown?.());
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  }
  server = undefined;
  shutdown = undefined;
  await rm(tmpRoot, { recursive: true, force: true });
});

describe('GET /api/plugins', () => {
  it('hides synthesized bundle resource children from public list and search surfaces', async () => {
    const bundleRoot = await writeBundleFixture('public-bundle');
    await installPlugin(bundleRoot);

    const resp = await fetch(`${baseUrl}/api/plugins`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as { plugins: InstalledPluginRecord[] };
    const bundlePlugins = data.plugins.filter((plugin) => plugin.id.startsWith('public-bundle'));
    const ids = bundlePlugins.map((plugin) => plugin.id).sort();
    expect(ids).toEqual(['public-bundle', 'public-bundle/deck-skeleton']);

    const search = searchInstalledPlugins({ plugins: bundlePlugins, query: 'public-bundle' });
    expect(search.entries.map((entry) => entry.plugin.id).sort()).toEqual([
      'public-bundle',
      'public-bundle/deck-skeleton',
    ]);
    expect(bundlePlugins.some((plugin) => plugin.manifest.od?.hidden === true)).toBe(false);
  });
});

async function installPlugin(source: string): Promise<void> {
  const resp = await fetch(`${baseUrl}/api/plugins/install`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({ source }),
  });
  expect(resp.status).toBe(200);
  if (!resp.body) throw new Error('install stream missing body');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let raw = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }
  if (!raw.includes('event: success')) {
    throw new Error(`installer did not finalize:\n${raw}`);
  }
}

async function writeBundleFixture(id: string): Promise<string> {
  const bundleRoot = path.join(tmpRoot, id);
  await mkdir(path.join(bundleRoot, 'skills', 'deck-skeleton'), { recursive: true });
  await mkdir(path.join(bundleRoot, 'design-systems', 'linear-clone'), { recursive: true });
  await mkdir(path.join(bundleRoot, 'craft'), { recursive: true });
  await writeFile(path.join(bundleRoot, 'SKILL.md'), `# ${id}\n`);
  await writeFile(path.join(bundleRoot, 'open-design.json'), JSON.stringify({
    name: id,
    version: '1.0.0',
    title: 'Public Bundle',
    od: {
      kind: 'bundle',
      bundle: {
        skills: [{ id: 'deck-skeleton', path: 'skills/deck-skeleton' }],
        designSystems: [{ id: 'linear-clone', path: 'design-systems/linear-clone' }],
        craft: [{ id: 'deck-pacing', path: 'craft/deck-pacing.md' }],
      },
    },
  }, null, 2));
  await writeFile(path.join(bundleRoot, 'skills', 'deck-skeleton', 'SKILL.md'), [
    '---',
    'name: deck-skeleton',
    'description: Deck skeleton skill',
    '---',
    '# Deck Skeleton',
  ].join('\n'));
  await writeFile(path.join(bundleRoot, 'skills', 'deck-skeleton', 'open-design.json'), JSON.stringify({
    name: 'deck-skeleton',
    version: '1.0.0',
    title: 'Deck Skeleton',
    od: { kind: 'skill' },
  }, null, 2));
  await writeFile(path.join(bundleRoot, 'design-systems', 'linear-clone', 'DESIGN.md'), '# Linear Clone\n');
  await writeFile(path.join(bundleRoot, 'craft', 'deck-pacing.md'), '# Deck Pacing\n');
  return bundleRoot;
}
