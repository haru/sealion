import { test, expect, type Page } from "@playwright/test";

const LOGIN_EMAIL = process.env.E2E_USER_EMAIL ?? "admin@example.com";
const LOGIN_PASSWORD = process.env.E2E_USER_PASSWORD ?? "password123";

/** Logs in via the login form. */
async function login(page: Page) {
  await page.goto("/login");
  await page.fill('[name="email"]', LOGIN_EMAIL);
  await page.fill('[name="password"]', LOGIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
}

/** Builds a mock GET /api/sync response body with one provider/project. */
function makeSyncResponse(lastSyncedAt: string | null, syncError: string | null = null) {
  return JSON.stringify({
    data: [
      {
        id: "prov-1",
        displayName: "GitHub",
        type: "GITHUB",
        projects: [
          {
            id: "proj-1",
            displayName: "repo",
            lastSyncedAt,
            syncError,
          },
        ],
      },
    ],
    error: null,
  });
}

/** Minimal issues mock — empty list. */
const EMPTY_ISSUES = JSON.stringify({ data: { items: [], total: 0 }, error: null });

test.describe("Sync Throttle — auto-sync on page load", () => {
  test("skips POST /api/sync when last sync was within 15 minutes", async ({ page }) => {
    const recentLastSyncedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
    let postSyncCalled = false;

    await page.route("**/api/sync", async (route) => {
      if (route.request().method() === "POST") {
        postSyncCalled = true;
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({ data: { syncing: true }, error: null }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: makeSyncResponse(recentLastSyncedAt, null),
        });
      }
    });

    await page.route("**/api/issues*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_ISSUES });
    });

    await login(page);

    // Wait long enough for init() to complete and any startSync() call to fire
    await page.waitForTimeout(2000);

    expect(postSyncCalled).toBe(false);
  });

  test("calls POST /api/sync when last sync was more than 15 minutes ago", async ({ page }) => {
    const oldLastSyncedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 min ago
    let postSyncCalled = false;

    await page.route("**/api/sync", async (route) => {
      if (route.request().method() === "POST") {
        postSyncCalled = true;
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({ data: { syncing: true }, error: null }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: makeSyncResponse(oldLastSyncedAt, null),
        });
      }
    });

    await page.route("**/api/issues*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_ISSUES });
    });

    await login(page);

    // Wait for init() to complete and startSync() to fire
    await page.waitForTimeout(2000);

    expect(postSyncCalled).toBe(true);
  });

  test("calls POST /api/sync when all projects have sync errors (no successful project)", async ({
    page,
  }) => {
    const recentLastSyncedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    let postSyncCalled = false;

    await page.route("**/api/sync", async (route) => {
      if (route.request().method() === "POST") {
        postSyncCalled = true;
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({ data: { syncing: true }, error: null }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: makeSyncResponse(recentLastSyncedAt, "SYNC_FAILED"),
        });
      }
    });

    await page.route("**/api/issues*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_ISSUES });
    });

    await login(page);
    await page.waitForTimeout(2000);

    expect(postSyncCalled).toBe(true);
  });
});

test.describe("Sync Throttle — Sync Now button", () => {
  test("Sync Now button is visible when providers exist", async ({ page }) => {
    const recentLastSyncedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    await page.route("**/api/sync", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({ data: { syncing: true }, error: null }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: makeSyncResponse(recentLastSyncedAt, null),
        });
      }
    });

    await page.route("**/api/issues*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_ISSUES });
    });

    await login(page);

    await expect(page.getByRole("button", { name: /sync now/i })).toBeVisible();
  });

  test("clicking Sync Now triggers POST /api/sync within throttle window", async ({ page }) => {
    const recentLastSyncedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // throttled
    let postSyncCallCount = 0;

    await page.route("**/api/sync", async (route) => {
      if (route.request().method() === "POST") {
        postSyncCallCount++;
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({ data: { syncing: true }, error: null }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: makeSyncResponse(recentLastSyncedAt, null),
        });
      }
    });

    await page.route("**/api/issues*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_ISSUES });
    });

    await login(page);
    // Auto-sync skipped (throttled) — postSyncCallCount should be 0 so far
    await page.waitForTimeout(1000);
    expect(postSyncCallCount).toBe(0);

    // Click Sync Now — should trigger POST /api/sync
    await page.getByRole("button", { name: /sync now/i }).click();
    await page.waitForTimeout(500);

    expect(postSyncCallCount).toBe(1);
  });

  test("Sync Now button is disabled while syncing", async ({ page }) => {
    const oldLastSyncedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // triggers auto-sync

    await page.route("**/api/sync", async (route) => {
      if (route.request().method() === "POST") {
        // Slow response to keep isSyncing === true
        await new Promise((r) => setTimeout(r, 5000));
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({ data: { syncing: true }, error: null }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: makeSyncResponse(oldLastSyncedAt, null),
        });
      }
    });

    await page.route("**/api/issues*", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_ISSUES });
    });

    await login(page);

    // Auto-sync fires (old lastSyncedAt) — wait for isSyncing to become true
    await page.waitForTimeout(1000);

    // Button should be disabled while syncing
    await expect(page.getByRole("button", { name: /sync now/i })).toBeDisabled();
  });
});
