/** @jest-environment node */

/**
 * Tests for the Next.js instrumentation hook (`src/instrumentation.ts`).
 *
 * Verifies that proxy logging is called in Node.js-compatible runtimes and
 * skipped in the Edge runtime, where Node.js built-ins (hpagent) are unavailable.
 */

// Mock the proxy module so we can assert on logProxyConfig calls without
// executing the real hpagent-dependent implementation.
jest.mock("@/lib/proxy", () => ({
  logProxyConfig: jest.fn(),
}));

import { logProxyConfig } from "@/lib/proxy";

const mockLogProxyConfig = logProxyConfig as jest.Mock;

/** Saves and restores NEXT_RUNTIME around each test. */
function withNextRuntime(value: string | undefined, fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const saved = process.env.NEXT_RUNTIME;
    if (value === undefined) {
      delete process.env.NEXT_RUNTIME;
    } else {
      process.env.NEXT_RUNTIME = value;
    }
    try {
      await fn();
    } finally {
      if (saved === undefined) {
        delete process.env.NEXT_RUNTIME;
      } else {
        process.env.NEXT_RUNTIME = saved;
      }
    }
  };
}

describe("register() — instrumentation hook", () => {
  beforeEach(() => {
    mockLogProxyConfig.mockClear();
    // Re-import register fresh for each test so module cache does not hide changes.
    jest.resetModules();
  });

  it(
    "calls logProxyConfig when NEXT_RUNTIME is 'nodejs'",
    withNextRuntime("nodejs", async () => {
      jest.resetModules();
      jest.mock("@/lib/proxy", () => ({ logProxyConfig: mockLogProxyConfig }));
      const { register } = await import("@/instrumentation");
      await register();
      expect(mockLogProxyConfig).toHaveBeenCalledTimes(1);
    }),
  );

  it(
    "calls logProxyConfig when NEXT_RUNTIME is undefined (plain Node.js process)",
    withNextRuntime(undefined, async () => {
      jest.resetModules();
      jest.mock("@/lib/proxy", () => ({ logProxyConfig: mockLogProxyConfig }));
      const { register } = await import("@/instrumentation");
      await register();
      expect(mockLogProxyConfig).toHaveBeenCalledTimes(1);
    }),
  );

  it(
    "does NOT call logProxyConfig when NEXT_RUNTIME is 'edge'",
    withNextRuntime("edge", async () => {
      jest.resetModules();
      jest.mock("@/lib/proxy", () => ({ logProxyConfig: mockLogProxyConfig }));
      const { register } = await import("@/instrumentation");
      await register();
      expect(mockLogProxyConfig).not.toHaveBeenCalled();
    }),
  );
});
