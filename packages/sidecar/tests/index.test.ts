import { describe, expect, it } from "vitest";
import { join, resolve } from "node:path";

import {
  bootstrapSidecarRuntime,
  createControlEndpoint,
  createSidecarLaunchEnv,
  normalizeControlEndpoint,
  parseControlEndpoint,
  resolveAppRuntimePath,
  resolveNamespace,
  resolveNamespaceRoot,
  resolveSidecarBase,
  resolveSourceRuntimeRoot,
  type SidecarContractDescriptor,
  type SidecarStampShape,
} from "../src/index.js";

type FakeStamp = SidecarStampShape & {
  app: "api" | "ui";
  mode: "dev" | "prod";
  source: "tool" | "pack";
};

const fakeContract: SidecarContractDescriptor<FakeStamp> = {
  defaults: {
    host: "127.0.0.1",
    namespace: "default",
    projectTmpDirName: ".fake-tmp",
  },
  env: {
    base: "FAKE_BASE",
    endpoint: "FAKE_ENDPOINT",
    namespace: "FAKE_NAMESPACE",
    source: "FAKE_SOURCE",
  },
  normalizeApp(value) {
    if (value === "api" || value === "ui") return value;
    throw new Error(`unsupported fake app: ${String(value)}`);
  },
  normalizeNamespace(value) {
    if (typeof value !== "string" || !/^[a-z0-9-]+$/.test(value)) {
      throw new Error("invalid fake namespace");
    }
    return value;
  },
  normalizeSource(value) {
    if (value === "tool" || value === "pack") return value;
    throw new Error(`unsupported fake source: ${String(value)}`);
  },
  normalizeStamp(value) {
    const stamp = value as Partial<FakeStamp>;
    return {
      app: this.normalizeApp(stamp.app),
      endpoint: String(stamp.endpoint),
      mode: stamp.mode === "prod" ? "prod" : "dev",
      namespace: this.normalizeNamespace(stamp.namespace),
      source: this.normalizeSource(stamp.source),
    };
  },
};

describe("generic sidecar path boundary", () => {
  it("uses descriptor defaults instead of Open Design constants", () => {
    const sourceRoot = resolveSourceRuntimeRoot({
      contract: fakeContract,
      projectRoot: "/repo/product",
      source: "tool",
    });

    expect(sourceRoot).toBe(resolve("/repo/product", ".fake-tmp", "tool"));
    expect(resolveNamespaceRoot({ base: sourceRoot, contract: fakeContract, namespace: "alpha" })).toBe(
      join(sourceRoot, "alpha"),
    );
    expect(
      resolveAppRuntimePath({
        app: "ui",
        contract: fakeContract,
        fileName: "cache",
        namespaceRoot: join(sourceRoot, "alpha"),
      }),
    ).toBe(join(sourceRoot, "alpha", "ui", "cache"));
  });

  it("formats loopback control endpoints", () => {
    expect(createControlEndpoint(17401)).toBe("tcp://127.0.0.1:17401");
    expect(normalizeControlEndpoint("tcp://127.0.0.1:17401")).toBe("tcp://127.0.0.1:17401");
    expect(normalizeControlEndpoint("tcp://127.0.0.1:17401/")).toBe("tcp://127.0.0.1:17401");
    expect(parseControlEndpoint("tcp://127.0.0.1:17401")).toEqual({ host: "127.0.0.1", port: 17401 });
    expect(() => createControlEndpoint(0)).toThrow();
    expect(() => normalizeControlEndpoint("http://127.0.0.1:17401")).toThrow();
  });

  it("resolves namespace and base from descriptor env names", () => {
    const env = {
      FAKE_BASE: "/runtime/base",
      FAKE_NAMESPACE: "selected",
    };

    expect(resolveNamespace({ contract: fakeContract, env })).toBe("selected");
    expect(resolveSidecarBase({ contract: fakeContract, env, projectRoot: "/repo/product", source: "tool" })).toBe(resolve("/runtime/base"));
  });
});

describe("generic sidecar bootstrap", () => {
  it("creates and validates launch env from descriptor env names", () => {
    const stamp: FakeStamp = {
      app: "api",
      endpoint: createControlEndpoint(17401),
      mode: "dev",
      namespace: "alpha",
      source: "tool",
    };

    expect(createSidecarLaunchEnv({ base: "/runtime/base", contract: fakeContract, extraEnv: {}, stamp })).toEqual({
      FAKE_BASE: resolve("/runtime/base"),
      FAKE_ENDPOINT: stamp.endpoint,
      FAKE_NAMESPACE: stamp.namespace,
      FAKE_SOURCE: stamp.source,
    });

    expect(
      bootstrapSidecarRuntime(stamp, { FAKE_BASE: resolve("/runtime/base") }, { app: "api", contract: fakeContract }),
    ).toEqual({
      app: "api",
      base: resolve("/runtime/base"),
      endpoint: stamp.endpoint,
      mode: "dev",
      namespace: "alpha",
      source: "tool",
    });
  });
});
