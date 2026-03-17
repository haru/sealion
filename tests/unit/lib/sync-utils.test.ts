import { allProjectsSynced } from "@/lib/sync-utils";

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

  it("returns false when a project has a syncError even if lastSyncedAt is after since", () => {
    const providers = [
      {
        projects: [
          { lastSyncedAt: AFTER.toISOString(), syncError: "SYNC_FAILED" },
        ],
      },
    ];
    expect(allProjectsSynced(providers, SYNC_START)).toBe(false);
  });

  it("returns false when a project has RATE_LIMITED error", () => {
    const providers = [
      {
        projects: [
          { lastSyncedAt: AFTER.toISOString(), syncError: "RATE_LIMITED" },
        ],
      },
    ];
    expect(allProjectsSynced(providers, SYNC_START)).toBe(false);
  });
});
