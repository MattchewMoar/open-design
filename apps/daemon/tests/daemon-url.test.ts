import { describe, expect, it } from "vitest";
import { allocatePort, createControlEndpoint, createJsonControlServer, type JsonControlServerHandle } from "@open-design/sidecar";
import { SIDECAR_ENV, SIDECAR_MESSAGES } from "@open-design/sidecar-proto";
import { resolveDaemonUrl, DEFAULT_DAEMON_URL } from "../src/daemon-url.js";

// Verifies the resolution chain: --daemon-url > OD_DAEMON_URL > sidecar
// control status discovery > built-in default. Each layer must short-circuit the next
// so `od` clients follow the live daemon across ephemeral-port restarts.

describe("resolveDaemonUrl", () => {
  it("prefers the explicit --daemon-url flag", async () => {
    const url = await resolveDaemonUrl({
      flagUrl: "http://flag.example:1111",
      env: {
        OD_DAEMON_URL: "http://env.example:2222",
        [SIDECAR_ENV.ENDPOINT]: "tcp://127.0.0.1:17401",
      },
    });
    expect(url).toBe("http://flag.example:1111");
  });

  it("falls back to OD_DAEMON_URL when no flag given", async () => {
    const url = await resolveDaemonUrl({
      env: {
        OD_DAEMON_URL: "http://env.example:2222",
        [SIDECAR_ENV.ENDPOINT]: "tcp://127.0.0.1:17401",
      },
    });
    expect(url).toBe("http://env.example:2222");
  });

  it("returns the legacy default when no flag/env/socket is available", async () => {
    const url = await resolveDaemonUrl({
      env: {
        [SIDECAR_ENV.ENDPOINT]: "tcp://127.0.0.1:1",
      },
      timeoutMs: 200,
    });
    expect(url).toBe(DEFAULT_DAEMON_URL);
  });

  it("discovers the live daemon URL via the concrete sidecar control endpoint", async () => {
    const endpoint = createControlEndpoint((await allocatePort({ label: "daemon-url-test" })).port);
    let control: JsonControlServerHandle | null = null;
    try {
      control = await createJsonControlServer({
        endpoint,
        handler: (message) => {
          if (
            message != null &&
            typeof message === "object" &&
            (message as { type?: unknown }).type === SIDECAR_MESSAGES.STATUS
          ) {
            return {
              pid: 4242,
              state: "running",
              updatedAt: new Date().toISOString(),
              url: "http://127.0.0.1:54321",
            };
          }
          throw new Error("unexpected message");
        },
      });

      const url = await resolveDaemonUrl({
        env: {
          [SIDECAR_ENV.ENDPOINT]: endpoint,
        },
        timeoutMs: 1000,
      });
      expect(url).toBe("http://127.0.0.1:54321");
    } finally {
      await control?.close();
    }
  });
});
