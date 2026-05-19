/** @jest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { useSyncPolling } from "@/hooks/useSyncPolling";

// Silence console.error during tests
let consoleSpy: jest.SpyInstance;
beforeAll(() => {
  consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => {
  consoleSpy.mockRestore();
});

// --- Helpers ---

function makeFetchOk(body: object): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(body),
  });
}

function makeFetchNotOk(status = 500): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: jest.fn().mockResolvedValue({ error: "INTERNAL_ERROR" }),
  });
}

function makeFetchNetworkError(): jest.Mock {
  return jest.fn().mockRejectedValue(new Error("network failure"));
}

// Fixed ISO strings — stable across runs and resistant to timer interactions.
const PROVIDERS_ALL_SYNCED = [
  {
    id: "p1",
    displayName: "GitHub",
    type: "GITHUB",
    projects: [
      {
        id: "proj1",
        displayName: "repo",
        lastSyncedAt: "2026-01-01T12:00:00Z",
        syncError: null,
      },
    ],
  },
];

// Post-sync response: same project with a newer lastSyncedAt — triggers completion.
const PROVIDERS_AFTER_SYNC = [
  {
    id: "p1",
    displayName: "GitHub",
    type: "GITHUB",
    projects: [
      {
        id: "proj1",
        displayName: "repo",
        lastSyncedAt: "2026-01-01T12:01:00Z",
        syncError: null,
      },
    ],
  },
];

const PROVIDERS_NOT_SYNCED = [
  {
    id: "p1",
    displayName: "GitHub",
    type: "GITHUB",
    projects: [
      {
        id: "proj1",
        displayName: "repo",
        lastSyncedAt: null,
        syncError: null,
      },
    ],
  },
];

describe("useSyncPolling", () => {
  let onSyncComplete: jest.Mock;
  let addErrorMessage: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    onSyncComplete = jest.fn().mockResolvedValue(undefined);
    addErrorMessage = jest.fn();
    global.fetch = jest.fn();
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // --- startSync: non-2xx response should not leave isSyncing=true ---
  describe("startSync — response.ok check", () => {
    it("sets isSyncing=false and calls addErrorMessage when POST /api/sync returns non-2xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

      const { result } = renderHook(() =>
        useSyncPolling(onSyncComplete, addErrorMessage, "Sync error")
      );

      await act(async () => {
        result.current.handleSyncNow();
        // Let the async fetch settle
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.isSyncing).toBe(false);
      expect(addErrorMessage).toHaveBeenCalledWith("error", "Sync error");
    });

    it("keeps isSyncing=true and starts polling when POST /api/sync returns 2xx", async () => {
      // POST succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() =>
        useSyncPolling(onSyncComplete, addErrorMessage, "Sync error")
      );

      await act(async () => {
        result.current.handleSyncNow();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.isSyncing).toBe(true);
    });
  });

  // --- poll(): network error stops syncing and notifies user ---
  describe("poll — try/catch on network error", () => {
    it("sets isSyncing=false and calls addErrorMessage when GET /api/sync throws", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true }) // POST
        .mockRejectedValue(new Error("network failure")); // all subsequent GETs

      const { result } = renderHook(() =>
        useSyncPolling(onSyncComplete, addErrorMessage, "Sync error")
      );

      await act(async () => {
        result.current.handleSyncNow();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.isSyncing).toBe(true);

      await act(async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.isSyncing).toBe(false);
      expect(addErrorMessage).toHaveBeenCalledWith("error", "Sync error");
      expect(onSyncComplete).not.toHaveBeenCalled();
    });
  });

  // --- poll(): successful completion path ---
  describe("poll — sync completion", () => {
    it("calls onSyncComplete and sets isSyncing=false when all projects synced", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true }) // POST
        .mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({ data: PROVIDERS_AFTER_SYNC }),
        }); // GET polls

      const { result } = renderHook(() =>
        useSyncPolling(onSyncComplete, addErrorMessage, "Sync error")
      );

      await act(async () => {
        result.current.setSyncProviders(PROVIDERS_ALL_SYNCED);
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        result.current.handleSyncNow();
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(onSyncComplete).toHaveBeenCalledTimes(1);
      expect(result.current.isSyncing).toBe(false);
    });

    it("reschedules polling after a non-2xx GET response instead of stopping", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true })          // POST
        .mockResolvedValueOnce({ ok: false, status: 503 }) // first GET: non-OK
        .mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({ data: PROVIDERS_AFTER_SYNC }),
        }); // second GET: success

      const { result } = renderHook(() =>
        useSyncPolling(onSyncComplete, addErrorMessage, "Sync error")
      );

      await act(async () => {
        result.current.setSyncProviders(PROVIDERS_ALL_SYNCED);
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        result.current.handleSyncNow();
        await Promise.resolve();
        await Promise.resolve();
      });

      // First poll: non-OK — should NOT stop syncing
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.isSyncing).toBe(true);
      expect(addErrorMessage).not.toHaveBeenCalled();

      // Second poll: success — should complete
      await act(async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(onSyncComplete).toHaveBeenCalledTimes(1);
      expect(result.current.isSyncing).toBe(false);
    });
  });

  // --- poll(): safety timeout ---
  describe("poll — safety timeout", () => {
    it("calls addErrorMessage and onSyncComplete after 120 s when sync never completes (FR-003, FR-004, SC-002)", async () => {
      // Polling always returns not-yet-complete data so the safety timeout fires.
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true }) // POST
        .mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({ data: PROVIDERS_NOT_SYNCED }),
        }); // GET polls — lastSyncedAt stays null, never matches baseline change

      const { result } = renderHook(() =>
        useSyncPolling(onSyncComplete, addErrorMessage, "Sync error")
      );

      await act(async () => {
        result.current.handleSyncNow();
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(120000);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(addErrorMessage).toHaveBeenCalledWith("error", "Sync error");
      expect(onSyncComplete).toHaveBeenCalledTimes(1);
      expect(result.current.isSyncing).toBe(false);
    });
  });

  // --- setSyncProviders ---
  describe("setSyncProviders", () => {
    it("updates syncProviders state", () => {
      const { result } = renderHook(() =>
        useSyncPolling(onSyncComplete, addErrorMessage, "Sync error")
      );

      act(() => {
        result.current.setSyncProviders(PROVIDERS_NOT_SYNCED);
      });

      expect(result.current.syncProviders).toEqual(PROVIDERS_NOT_SYNCED);
    });
  });

  // --- maybeAutoSync ---
  describe("maybeAutoSync", () => {
    it("triggers sync when projects have never synced", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useSyncPolling(onSyncComplete, addErrorMessage, "Sync error")
      );

      await act(async () => {
        result.current.maybeAutoSync(PROVIDERS_NOT_SYNCED);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/sync", { method: "POST" });
    });

    it("does not trigger sync when projects were recently synced", async () => {
      const recentlySynced = [
        {
          id: "p1",
          displayName: "GitHub",
          type: "GITHUB",
          projects: [
            {
              id: "proj1",
              displayName: "repo",
              lastSyncedAt: new Date().toISOString(),
              syncError: null,
            },
          ],
        },
      ];

      const { result } = renderHook(() =>
        useSyncPolling(onSyncComplete, addErrorMessage, "Sync error")
      );

      await act(async () => {
        result.current.maybeAutoSync(recentlySynced);
        await Promise.resolve();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
