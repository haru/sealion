import { allProjectsSynced, shouldThrottleSync } from "@/lib/sync-utils";

const PAST = new Date("2026-01-01T00:00:00Z");
const SYNC_START = new Date("2026-03-15T10:00:00Z");
const AFTER = new Date("2026-03-15T10:01:00Z");

describe("allProjectsSynced", () => {
  it("returns true when there are no providers", () => {
    expect(allProjectsSynced([], SYNC_START)).toBe(true);
  });

  it("returns true when all providers have no projects", () => {
    expect(allProjectsSynced([{ projects: [] }], SYNC_START)).toBe(true);
  });

  it("returns true when all projects were synced after since", () => {
    const providers = [
      {
        projects: [
          { lastSyncedAt: AFTER.toISOString(), syncError: null },
        ],
      },
    ];
    expect(allProjectsSynced(providers, SYNC_START)).toBe(true);
  });

  it("returns true when lastSyncedAt equals since exactly", () => {
    const providers = [
      { projects: [{ lastSyncedAt: SYNC_START.toISOString(), syncError: null }] },
    ];
    expect(allProjectsSynced(providers, SYNC_START)).toBe(true);
  });

  it("returns true when multiple projects across providers are all synced", () => {
    const providers = [
      { projects: [{ lastSyncedAt: AFTER.toISOString(), syncError: null }] },
      { projects: [{ lastSyncedAt: AFTER.toISOString(), syncError: null }] },
    ];
    expect(allProjectsSynced(providers, SYNC_START)).toBe(true);
  });

  it("returns false when a project has never been synced", () => {
    const providers = [
      { projects: [{ lastSyncedAt: null, syncError: null }] },
    ];
    expect(allProjectsSynced(providers, SYNC_START)).toBe(false);
  });

  it("returns false when a project was synced before since", () => {
    const providers = [
      { projects: [{ lastSyncedAt: PAST.toISOString(), syncError: null }] },
    ];
    expect(allProjectsSynced(providers, SYNC_START)).toBe(false);
  });

  it("returns false when only some projects are synced", () => {
    const providers = [
      {
        projects: [
          { lastSyncedAt: AFTER.toISOString(), syncError: null },
          { lastSyncedAt: null, syncError: null },
        ],
      },
    ];
    expect(allProjectsSynced(providers, SYNC_START)).toBe(false);
  });

  it("checks across multiple providers", () => {
    const providers = [
      { projects: [{ lastSyncedAt: AFTER.toISOString(), syncError: null }] },
      { projects: [{ lastSyncedAt: PAST.toISOString(), syncError: null }] },
    ];
    expect(allProjectsSynced(providers, SYNC_START)).toBe(false);
  });

  it("returns true when a project has a syncError but lastSyncedAt is after since", () => {
    const providers = [
      {
        projects: [
          { lastSyncedAt: AFTER.toISOString(), syncError: "SYNC_FAILED" },
        ],
      },
    ];
    expect(allProjectsSynced(providers, SYNC_START)).toBe(true);
  });

  it("returns true when a project has RATE_LIMITED error but lastSyncedAt is after since", () => {
    const providers = [
      {
        projects: [
          { lastSyncedAt: AFTER.toISOString(), syncError: "RATE_LIMITED" },
        ],
      },
    ];
    expect(allProjectsSynced(providers, SYNC_START)).toBe(true);
  });
});

describe("shouldThrottleSync", () => {
  const THROTTLE_MS = 15 * 60 * 1000; // 15 minutes
  const NOW = new Date("2026-03-15T12:00:00Z").getTime();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function makeProviders(
    projects: { lastSyncedAt: string | null; syncError: string | null }[]
  ) {
    return [{ projects }];
  }

  function msAgo(ms: number): string {
    return new Date(NOW - ms).toISOString();
  }

  it("returns false when there are no providers", () => {
    expect(shouldThrottleSync([], THROTTLE_MS)).toBe(false);
  });

  it("returns false when providers have no projects", () => {
    expect(shouldThrottleSync([{ projects: [] }], THROTTLE_MS)).toBe(false);
  });

  it("returns false when no project has a lastSyncedAt (never synced)", () => {
    const providers = makeProviders([{ lastSyncedAt: null, syncError: null }]);
    expect(shouldThrottleSync(providers, THROTTLE_MS)).toBe(false);
  });

  it("returns false when all projects have syncError (all failed, recent)", () => {
    const providers = makeProviders([
      { lastSyncedAt: msAgo(5 * 60 * 1000), syncError: "SYNC_FAILED" },
    ]);
    expect(shouldThrottleSync(providers, THROTTLE_MS)).toBe(false);
  });

  it("returns true when partial success exists and last sync was 5 min ago", () => {
    const providers = makeProviders([
      { lastSyncedAt: msAgo(5 * 60 * 1000), syncError: null },
      { lastSyncedAt: msAgo(5 * 60 * 1000), syncError: "SYNC_FAILED" },
    ]);
    expect(shouldThrottleSync(providers, THROTTLE_MS)).toBe(true);
  });

  it("returns true when full success and last sync was 14m 59s ago", () => {
    const providers = makeProviders([
      { lastSyncedAt: msAgo(14 * 60 * 1000 + 59 * 1000), syncError: null },
    ]);
    expect(shouldThrottleSync(providers, THROTTLE_MS)).toBe(true);
  });

  it("returns false when last sync was exactly 15 min ago (boundary — sync runs)", () => {
    const providers = makeProviders([
      { lastSyncedAt: msAgo(THROTTLE_MS), syncError: null },
    ]);
    expect(shouldThrottleSync(providers, THROTTLE_MS)).toBe(false);
  });

  it("returns false when last sync was 20 min ago", () => {
    const providers = makeProviders([
      { lastSyncedAt: msAgo(20 * 60 * 1000), syncError: null },
    ]);
    expect(shouldThrottleSync(providers, THROTTLE_MS)).toBe(false);
  });

  it("uses max lastSyncedAt across all projects when checking time condition", () => {
    // One project synced 5 min ago (recent) with success,
    // another synced 20 min ago with error — max is 5 min → throttled
    const providers = makeProviders([
      { lastSyncedAt: msAgo(5 * 60 * 1000), syncError: null },
      { lastSyncedAt: msAgo(20 * 60 * 1000), syncError: "SYNC_FAILED" },
    ]);
    expect(shouldThrottleSync(providers, THROTTLE_MS)).toBe(true);
  });

  it("checks across multiple providers", () => {
    const providers = [
      { projects: [{ lastSyncedAt: msAgo(5 * 60 * 1000), syncError: null }] },
      { projects: [{ lastSyncedAt: msAgo(3 * 60 * 1000), syncError: null }] },
    ];
    expect(shouldThrottleSync(providers, THROTTLE_MS)).toBe(true);
  });

  it("returns false when only project with null syncError has null lastSyncedAt", () => {
    const providers = makeProviders([
      { lastSyncedAt: null, syncError: null },
      { lastSyncedAt: msAgo(5 * 60 * 1000), syncError: "SYNC_FAILED" },
    ]);
    // Condition 2 requires lastSyncedAt !== null AND syncError === null
    expect(shouldThrottleSync(providers, THROTTLE_MS)).toBe(false);
  });

  it("returns true with a custom shorter throttle window", () => {
    const fiveMinMs = 5 * 60 * 1000;
    const providers = makeProviders([
      { lastSyncedAt: msAgo(3 * 60 * 1000), syncError: null },
    ]);
    expect(shouldThrottleSync(providers, fiveMinMs)).toBe(true);
  });

  it("returns false when elapsed exceeds custom shorter throttle window", () => {
    const fiveMinMs = 5 * 60 * 1000;
    const providers = makeProviders([
      { lastSyncedAt: msAgo(6 * 60 * 1000), syncError: null },
    ]);
    expect(shouldThrottleSync(providers, fiveMinMs)).toBe(false);
  });
});
