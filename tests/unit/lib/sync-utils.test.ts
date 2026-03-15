import { allEnabledProjectsSynced } from "@/lib/sync-utils";

const PAST = new Date("2026-01-01T00:00:00Z");
const SYNC_START = new Date("2026-03-15T10:00:00Z");
const AFTER = new Date("2026-03-15T10:01:00Z");

describe("allEnabledProjectsSynced", () => {
  it("returns true when there are no providers", () => {
    expect(allEnabledProjectsSynced([], SYNC_START)).toBe(true);
  });

  it("returns true when all providers have no projects", () => {
    expect(allEnabledProjectsSynced([{ projects: [] }], SYNC_START)).toBe(true);
  });

  it("returns true when there are no enabled projects", () => {
    const providers = [
      { projects: [{ isEnabled: false, lastSyncedAt: null, syncError: null }] },
    ];
    expect(allEnabledProjectsSynced(providers, SYNC_START)).toBe(true);
  });

  it("returns true when all enabled projects were synced after since", () => {
    const providers = [
      {
        projects: [
          { isEnabled: true, lastSyncedAt: AFTER.toISOString(), syncError: null },
          { isEnabled: false, lastSyncedAt: null, syncError: null },
        ],
      },
    ];
    expect(allEnabledProjectsSynced(providers, SYNC_START)).toBe(true);
  });

  it("returns true when lastSyncedAt equals since exactly", () => {
    const providers = [
      { projects: [{ isEnabled: true, lastSyncedAt: SYNC_START.toISOString(), syncError: null }] },
    ];
    expect(allEnabledProjectsSynced(providers, SYNC_START)).toBe(true);
  });

  it("returns false when an enabled project has never been synced", () => {
    const providers = [
      { projects: [{ isEnabled: true, lastSyncedAt: null, syncError: null }] },
    ];
    expect(allEnabledProjectsSynced(providers, SYNC_START)).toBe(false);
  });

  it("returns false when an enabled project was synced before since", () => {
    const providers = [
      { projects: [{ isEnabled: true, lastSyncedAt: PAST.toISOString(), syncError: null }] },
    ];
    expect(allEnabledProjectsSynced(providers, SYNC_START)).toBe(false);
  });

  it("returns false when only some enabled projects are synced", () => {
    const providers = [
      {
        projects: [
          { isEnabled: true, lastSyncedAt: AFTER.toISOString(), syncError: null },
          { isEnabled: true, lastSyncedAt: null, syncError: null },
        ],
      },
    ];
    expect(allEnabledProjectsSynced(providers, SYNC_START)).toBe(false);
  });

  it("checks across multiple providers", () => {
    const providers = [
      { projects: [{ isEnabled: true, lastSyncedAt: AFTER.toISOString(), syncError: null }] },
      { projects: [{ isEnabled: true, lastSyncedAt: PAST.toISOString(), syncError: null }] },
    ];
    expect(allEnabledProjectsSynced(providers, SYNC_START)).toBe(false);
  });

  it("returns false when an enabled project has a syncError even if lastSyncedAt is after since", () => {
    const providers = [
      {
        projects: [
          { isEnabled: true, lastSyncedAt: AFTER.toISOString(), syncError: "SYNC_FAILED" },
        ],
      },
    ];
    expect(allEnabledProjectsSynced(providers, SYNC_START)).toBe(false);
  });

  it("returns false when an enabled project has RATE_LIMITED error", () => {
    const providers = [
      {
        projects: [
          { isEnabled: true, lastSyncedAt: AFTER.toISOString(), syncError: "RATE_LIMITED" },
        ],
      },
    ];
    expect(allEnabledProjectsSynced(providers, SYNC_START)).toBe(false);
  });
});
