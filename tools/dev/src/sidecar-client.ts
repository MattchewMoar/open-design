import {
  APP_KEYS,
  OPEN_DESIGN_SIDECAR_CONTRACT,
  SIDECAR_MESSAGES,
  type DaemonStatusSnapshot,
  type DesktopStatusSnapshot,
  type WebStatusSnapshot,
} from "@open-design/sidecar-proto";
import { readAppControlEndpoint, requestJsonControl, resolveNamespaceRoot } from "@open-design/sidecar";

export type AppRuntimeLookup = {
  base: string;
  namespace: string;
};

function namespaceRoot(runtime: AppRuntimeLookup): string {
  return resolveNamespaceRoot({ base: runtime.base, contract: OPEN_DESIGN_SIDECAR_CONTRACT, namespace: runtime.namespace });
}

export async function resolveDaemonEndpoint(runtime: AppRuntimeLookup): Promise<string | null> {
  return await readAppControlEndpoint({
    app: APP_KEYS.DAEMON,
    contract: OPEN_DESIGN_SIDECAR_CONTRACT,
    namespaceRoot: namespaceRoot(runtime),
  });
}

export async function resolveWebEndpoint(runtime: AppRuntimeLookup): Promise<string | null> {
  return await readAppControlEndpoint({
    app: APP_KEYS.WEB,
    contract: OPEN_DESIGN_SIDECAR_CONTRACT,
    namespaceRoot: namespaceRoot(runtime),
  });
}

export async function resolveDesktopEndpoint(runtime: AppRuntimeLookup): Promise<string | null> {
  return await readAppControlEndpoint({
    app: APP_KEYS.DESKTOP,
    contract: OPEN_DESIGN_SIDECAR_CONTRACT,
    namespaceRoot: namespaceRoot(runtime),
  });
}

export async function inspectDaemonRuntime(runtime: AppRuntimeLookup, timeoutMs = 800): Promise<DaemonStatusSnapshot | null> {
  const endpoint = await resolveDaemonEndpoint(runtime);
  if (endpoint == null) return null;
  try {
    return await requestJsonControl<DaemonStatusSnapshot>(endpoint, { type: SIDECAR_MESSAGES.STATUS }, { timeoutMs });
  } catch {
    return null;
  }
}

export async function waitForDaemonRuntime(runtime: AppRuntimeLookup, timeoutMs = 35000): Promise<DaemonStatusSnapshot> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await inspectDaemonRuntime(runtime, 800);
    if (snapshot?.url != null) return snapshot;
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error("daemon did not expose status in time");
}

export async function inspectWebRuntime(runtime: AppRuntimeLookup, timeoutMs = 800): Promise<WebStatusSnapshot | null> {
  const endpoint = await resolveWebEndpoint(runtime);
  if (endpoint == null) return null;
  try {
    return await requestJsonControl<WebStatusSnapshot>(endpoint, { type: SIDECAR_MESSAGES.STATUS }, { timeoutMs });
  } catch {
    return null;
  }
}

export async function waitForWebRuntime(runtime: AppRuntimeLookup, timeoutMs = 35000): Promise<WebStatusSnapshot> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await inspectWebRuntime(runtime, 800);
    if (snapshot?.url != null) return snapshot;
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error("web did not expose status in time");
}

export async function inspectDesktopRuntime(runtime: AppRuntimeLookup, timeoutMs = 800): Promise<DesktopStatusSnapshot | null> {
  const endpoint = await resolveDesktopEndpoint(runtime);
  if (endpoint == null) return null;
  try {
    return await requestJsonControl<DesktopStatusSnapshot>(endpoint, { type: SIDECAR_MESSAGES.STATUS }, { timeoutMs });
  } catch {
    return null;
  }
}

export async function waitForDesktopRuntime(runtime: AppRuntimeLookup, timeoutMs = 15000): Promise<DesktopStatusSnapshot> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await inspectDesktopRuntime(runtime, 800);
    if (snapshot != null) return snapshot;
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error("desktop did not expose status in time");
}
