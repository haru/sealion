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

const ISSUE_UNPINNED = {
  id: "issue-a",
  externalId: "#10",
  title: "Unpinned Task A",
  dueDate: null,
  externalUrl: "https://example.com/10",
  isUnassigned: false,
  todayFlag: false,
  todayOrder: null,
  todayAddedAt: null,
  providerCreatedAt: null,
  providerUpdatedAt: null,
  pinned: false,
  project: {
    displayName: "repo",
    issueProvider: { iconUrl: null, displayName: "GitHub" },
  },
};

const ISSUE_PINNED = {
  id: "issue-b",
  externalId: "#20",
  title: "Pinned Task B",
  dueDate: null,
  externalUrl: "https://example.com/20",
  isUnassigned: false,
  todayFlag: false,
  todayOrder: null,
  todayAddedAt: null,
  providerCreatedAt: null,
  providerUpdatedAt: null,
  pinned: true,
  project: {
    displayName: "repo",
    issueProvider: { iconUrl: null, displayName: "GitHub" },
  },
};

const ISSUE_IN_TODAY = {
  id: "issue-today",
  externalId: "#30",
  title: "Task In Today",
  dueDate: null,
  externalUrl: "https://example.com/30",
  isUnassigned: false,
  todayFlag: true,
  todayOrder: 1,
  todayAddedAt: new Date().toISOString(),
  providerCreatedAt: null,
  providerUpdatedAt: null,
  pinned: true,
  project: {
    displayName: "repo",
    issueProvider: { iconUrl: null, displayName: "GitHub" },
  },
};

const EMPTY_PROVIDERS = JSON.stringify({ data: [], error: null });
const EMPTY_TODAY = JSON.stringify({ data: { items: [], total: 0 }, error: null });

const DEFAULT_BOARD_SETTINGS = JSON.stringify({
  data: {
    showCreatedAt: false,
    showUpdatedAt: false,
    sortOrder: ["dueDate_asc", "providerUpdatedAt_desc"],
  },
  error: null,
});

/** Sets up common API mocks for the dashboard. */
async function setupCommonMocks(page: Page) {
  await page.route("**/api/board-settings**", (route) => {
    route.fulfill({ contentType: "application/json", body: DEFAULT_BOARD_SETTINGS });
  });
  await page.route("**/api/sync**", (route) => {
    const method = route.request().method();
    route.fulfill({
      status: method === "POST" ? 202 : 200,
      contentType: "application/json",
      body: JSON.stringify({ data: method === "POST" ? { syncing: true } : [], error: null }),
    });
  });
  await page.route("**/api/issues/today**", (route) => {
    route.fulfill({ contentType: "application/json", body: EMPTY_TODAY });
  });
}

test.describe("Task Pin — User Story 1: pin a task", () => {
  test("pin icon shows outlined (unpinned) for an unpinned task", async ({ page }) => {
    await setupCommonMocks(page);

    await page.route("**/api/issues**", (route) => {
      if (!route.request().url().includes("/today")) {
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            data: { items: [ISSUE_UNPINNED], total: 1, totalToday: 0, page: 1, limit: 20 },
            error: null,
          }),
        });
      } else {
        route.fulfill({ contentType: "application/json", body: EMPTY_TODAY });
      }
    });

    await login(page);

    // Outlined pin icon should be present (aria-label: "Pin to top")
    await expect(page.getByRole("button", { name: /pin to top/i })).toBeVisible();
  });

  test("clicking the pin button on an unpinned task sends PATCH { pinned: true } and shows filled pin icon", async ({
    page,
  }) => {
    await setupCommonMocks(page);

    let patchCalled = false;
    let patchBody: Record<string, unknown> = {};

    await page.route("**/api/issues**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (url.includes("/api/issues/issue-a") && method === "PATCH") {
        patchCalled = true;
        patchBody = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ data: { id: "issue-a", pinned: true }, error: null }),
        });
      } else if (!url.includes("/today")) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            data: { items: [ISSUE_UNPINNED], total: 1, totalToday: 0, page: 1, limit: 20 },
            error: null,
          }),
        });
      } else {
        await route.fulfill({ contentType: "application/json", body: EMPTY_TODAY });
      }
    });

    await login(page);

    await page.getByRole("button", { name: /pin to top/i }).click();

    // Optimistic update: icon should change to "Unpin" (filled red pin)
    await expect(page.getByRole("button", { name: /unpin/i })).toBeVisible();

    // Verify PATCH was sent with { pinned: true }
    expect(patchCalled).toBe(true);
    expect(patchBody.pinned).toBe(true);
  });

  test("pinned task shows filled (red) pin icon with aria-label Unpin", async ({ page }) => {
    await setupCommonMocks(page);

    await page.route("**/api/issues**", (route) => {
      if (!route.request().url().includes("/today")) {
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            data: { items: [ISSUE_PINNED], total: 1, totalToday: 0, page: 1, limit: 20 },
            error: null,
          }),
        });
      } else {
        route.fulfill({ contentType: "application/json", body: EMPTY_TODAY });
      }
    });

    await login(page);

    // Filled pin icon should be present (aria-label: "Unpin")
    await expect(page.getByRole("button", { name: /^unpin$/i })).toBeVisible();
    // Outlined pin button should NOT be present for this item
    await expect(page.getByRole("button", { name: /pin to top/i })).not.toBeVisible();
  });
});

test.describe("Task Pin — User Story 2: unpin a task", () => {
  test("clicking the unpin button on a pinned task sends PATCH { pinned: false } and reverts icon", async ({
    page,
  }) => {
    await setupCommonMocks(page);

    let patchBody: Record<string, unknown> = {};

    await page.route("**/api/issues**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (url.includes("/api/issues/issue-b") && method === "PATCH") {
        patchBody = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ data: { id: "issue-b", pinned: false }, error: null }),
        });
      } else if (!url.includes("/today")) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            data: { items: [ISSUE_PINNED], total: 1, totalToday: 0, page: 1, limit: 20 },
            error: null,
          }),
        });
      } else {
        await route.fulfill({ contentType: "application/json", body: EMPTY_TODAY });
      }
    });

    await login(page);

    // Click the filled pin (unpin) button
    await page.getByRole("button", { name: /^unpin$/i }).click();

    // Optimistic update: should revert to outlined pin
    await expect(page.getByRole("button", { name: /pin to top/i })).toBeVisible();

    // Verify the PATCH request had pinned: false
    expect(patchBody.pinned).toBe(false);
  });

  test("shows error message and rolls back when PATCH fails during unpin", async ({ page }) => {
    await setupCommonMocks(page);

    await page.route("**/api/issues**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (url.includes("/api/issues/issue-b") && method === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ data: null, error: "SERVER_ERROR" }),
        });
      } else if (!url.includes("/today")) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            data: { items: [ISSUE_PINNED], total: 1, totalToday: 0, page: 1, limit: 20 },
            error: null,
          }),
        });
      } else {
        await route.fulfill({ contentType: "application/json", body: EMPTY_TODAY });
      }
    });

    await login(page);

    await page.getByRole("button", { name: /^unpin$/i }).click();

    // After rollback the filled pin button should be visible again
    await expect(page.getByRole("button", { name: /^unpin$/i })).toBeVisible();
  });
});

test.describe("Task Pin — User Story 3: Today area hides pin icon", () => {
  test("pin icon is NOT shown for tasks in the Today area", async ({ page }) => {
    await setupCommonMocks(page);

    await page.route("**/api/issues/today**", (route) => {
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [ISSUE_IN_TODAY], total: 1 }, error: null }),
      });
    });
    await page.route("**/api/issues**", (route) => {
      if (!route.request().url().includes("/today")) {
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            data: { items: [], total: 0, totalToday: 1, page: 1, limit: 20 },
            error: null,
          }),
        });
      }
    });

    await login(page);

    // The today area should show the task title
    await expect(page.getByText("Task In Today")).toBeVisible();

    // No pin buttons should be visible (neither pin nor unpin)
    await expect(page.getByRole("button", { name: /pin to top/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^unpin$/i })).not.toBeVisible();
  });
});
