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

    // Wait for init() GET to resolve (confirms init ran), then assert no POST was triggered
    const getResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/sync") && resp.request().method() === "GET"
    );
    await login(page);
    await getResponsePromise;

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

    // Wait for the POST to be made before asserting
    const postRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/sync") && req.method() === "POST"
    );
    await login(page);
    await postRequestPromise;

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

    const postRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/sync") && req.method() === "POST"
    );
    await login(page);
    await postRequestPromise;

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

    // Wait for init() GET to resolve (confirms init ran without POSTing), then assert no auto-sync
    const getResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/sync") && resp.request().method() === "GET"
    );
    await login(page);
    await getResponsePromise;
    expect(postSyncCallCount).toBe(0);

    // Click Sync Now and wait for the POST to be made
    const postRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/sync") && req.method() === "POST"
    );
    await page.getByRole("button", { name: /sync now/i }).click();
    await postRequestPromise;

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

    // Wait for the auto-sync POST to be triggered (old lastSyncedAt → not throttled)
    const postRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/sync") && req.method() === "POST"
    );
    await login(page);
    await postRequestPromise;

    // Button should be disabled while syncing (POST response is intentionally slow)
    await expect(page.getByRole("button", { name: /sync now/i })).toBeDisabled();
  });
});
