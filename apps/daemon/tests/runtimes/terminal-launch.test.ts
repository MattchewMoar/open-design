import { describe, expect, it } from 'vitest';

import { launchAgentInSystemTerminal } from '../../src/runtimes/terminal-launch.js';

describe('launchAgentInSystemTerminal', () => {
  // Surfaces a `system-terminal launch is not supported on ${platform}`
  // reason on unsupported platforms so the chat's auth banner can fall
  // back to the text-only guidance instead of throwing. Pins the
  // shape the web side asserts on (`{ ok: false, reason: string }`).
  it('rejects unsupported platforms with a structured failure', async () => {
    // `aix` is one of Node's `process.platform` values but not one any
    // OD user would actually run on. A typo'd / future platform should
    // surface the same shape.
    const result = await launchAgentInSystemTerminal('agy', 'aix');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.platform).toBe('aix');
    expect(result.reason).toContain('not supported');
    expect(result.reason).toContain('aix');
  });

  // The function defaults to `process.platform` when no override is
  // passed — required because the daemon endpoint calls it without an
  // argument and expects the real-machine path. Pin to ensure a
  // refactor doesn't accidentally drop the default.
  it('defaults the platform parameter to process.platform', async () => {
    // On every supported platform this either succeeds (launching a
    // terminal) or fails with a specific reason from the launcher
    // backend. What we're asserting is that the result's `platform`
    // matches process.platform, NOT that the launch necessarily
    // works in CI (it usually won't — no DISPLAY on Linux runners,
    // no GUI on macOS CI, etc.).
    const result = await launchAgentInSystemTerminal('agy');
    expect(result.platform).toBe(process.platform);
  });
});
