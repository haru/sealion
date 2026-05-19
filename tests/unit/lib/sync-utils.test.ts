import { allProjectsProcessed, shouldThrottleSync } from "@/lib/sync/sync-utils";

const PAST = "2026-01-01T00:00:00Z";
const SYNC_START = "2026-03-15T10:00:00Z";
const AFTER = "2026-03-15T10:01:00Z";

function makeBaseline(
  entries: Array<[string, string | null]>
): ReadonlyMap<string, string | null> {
  return new Map(entries);
}

describe("allProjectsProcessed", () => {
  it("returns true when there are no providers", () => {
    const baseline = makeBaseline([]);
    expect(allProjectsProcessed([], baseline)).toBe(true);
  });

  it("returns true when all providers have no projects", () => {
    const baseline = makeBaseline([]);
    expect(allProjectsProcessed([{ projects: [] }], baseline)).toBe(true);
  });

  it("returns true when all projects changed from baseline", () => {
    const baseline = makeBaseline([["p1", SYNC_START]]);
    const providers = [
      {
        projects: [
          { id: "p1", lastSyncedAt: AFTER, syncError: null },
        ],
      },
    ];
    expect(allProjectsProcessed(providers, baseline)).toBe(true);
  });

  it("returns true when project lastSyncedAt changed from null to non-null", () => {
    const baseline = makeBaseline([["p1", null]]);
    const providers = [
      {
        projects: [
          { id: "p1", lastSyncedAt: AFTER, syncError: null },
        ],
      },
    ];
    expect(allProjectsProcessed(providers, baseline)).toBe(true);
  });

  it("returns false when lastSyncedAt equals baseline value", () => {
    const baseline = makeBaseline([["p1", AFTER]]);
    const providers = [
      {
        projects: [
          { id: "p1", lastSyncedAt: AFTER, syncError: null },
        ],
      },
    ];
    expect(allProjectsProcessed(providers, baseline)).toBe(false);
  });

  it("returns true even when server clock is behind client clock", () => {
    const clientTime = "2026-03-15T10:00:05Z";
    const serverTime = "2026-03-15T10:00:02Z";
    const baseline = makeBaseline([["p1", clientTime]]);
    const providers = [
      {
        projects: [
          { id: "p1", lastSyncedAt: serverTime, syncError: null },
        ],
      },
    ];
    expect(allProjectsProcessed(providers, baseline)).toBe(true);
  });

  it("returns false when only some projects changed", () => {
    const baseline = makeBaseline([["p1", SYNC_START], ["p2", SYNC_START]]);
    const providers = [
      {
        projects: [
          { id: "p1", lastSyncedAt: AFTER, syncError: null },
          { id: "p2", lastSyncedAt: SYNC_START, syncError: null },
        ],
      },
    ];
    expect(allProjectsProcessed(providers, baseline)).toBe(false);
  });

  it("returns true with syncError when lastSyncedAt changed from baseline", () => {
    const baseline = makeBaseline([["p1", "2026-03-15T09:00:00Z"]]);
    const providers = [
      {
        projects: [
          { id: "p1", lastSyncedAt: "2026-03-15T10:00:00Z", syncError: "SYNC_FAILED" },
        ],
      },
    ];
    expect(allProjectsProcessed(providers, baseline)).toBe(true);
  });

  it("returns false when lastSyncedAt is null in both baseline and current", () => {
    const baseline = makeBaseline([["p1", null]]);
    const providers = [
      {
        projects: [
          { id: "p1", lastSyncedAt: null, syncError: null },
        ],
      },
    ];
    expect(allProjectsProcessed(providers, baseline)).toBe(false);
  });

  it("returns false when a project was synced before since (baseline unchanged)", () => {
    const baseline = makeBaseline([["p1", PAST]]);
    const providers = [
      {
        projects: [
          { id: "p1", lastSyncedAt: PAST, syncError: null },
        ],
      },
    ];
    expect(allProjectsProcessed(providers, baseline)).toBe(false);
  });

  it("returns true when multiple projects across providers are all processed", () => {
    const baseline = makeBaseline([["p1", SYNC_START], ["p2", SYNC_START]]);
    const providers = [
      { projects: [{ id: "p1", lastSyncedAt: AFTER, syncError: null }] },
      { projects: [{ id: "p2", lastSyncedAt: AFTER, syncError: null }] },
    ];
    expect(allProjectsProcessed(providers, baseline)).toBe(true);
  });

  it("returns false when one provider has unchanged project across multiple providers", () => {
    const baseline = makeBaseline([["p1", SYNC_START], ["p2", PAST]]);
    const providers = [
      { projects: [{ id: "p1", lastSyncedAt: AFTER, syncError: null }] },
      { projects: [{ id: "p2", lastSyncedAt: PAST, syncError: null }] },
    ];
    expect(allProjectsProcessed(providers, baseline)).toBe(false);
  });

  it("returns false when a project is missing from baseline", () => {
    const baseline = makeBaseline([["p1", SYNC_START]]);
    const providers = [
      {
        projects: [
          { id: "p1", lastSyncedAt: AFTER, syncError: null },
          { id: "p2", lastSyncedAt: AFTER, syncError: null },
        ],
      },
    ];
    expect(allProjectsProcessed(providers, baseline)).toBe(false);
  });

  it("returns true when a project has RATE_LIMITED error but lastSyncedAt changed from baseline", () => {
    const baseline = makeBaseline([["p1", SYNC_START]]);
    const providers = [
      {
        projects: [
          { id: "p1", lastSyncedAt: AFTER, syncError: "RATE_LIMITED" },
        ],
      },
    ];
    expect(allProjectsProcessed(providers, baseline)).toBe(true);
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
    const tagged = projects.map((p, i) => ({ id: `proj-${i}`, ...p }));
    return [{ projects: tagged }];
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
      { projects: [{ id: "proj-a", lastSyncedAt: msAgo(5 * 60 * 1000), syncError: null }] },
      { projects: [{ id: "proj-b", lastSyncedAt: msAgo(3 * 60 * 1000), syncError: null }] },
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
