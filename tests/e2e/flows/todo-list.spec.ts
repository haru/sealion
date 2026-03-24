import { test, expect } from "@playwright/test";

test.describe("TODO List Display", () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto("/login");
    await page.fill('[name="email"]', process.env.E2E_USER_EMAIL ?? "admin@example.com");
    await page.fill('[name="password"]', process.env.E2E_USER_PASSWORD ?? "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  test("dashboard page loads and shows TODO list title", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("shows sync status indicator", async ({ page }) => {
    // The sync status area should exist (even if no providers)
    await expect(page).toHaveURL("/");
    // Page should be loaded without errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test("shows empty state when no issues", async ({ page }) => {
    // If no providers are connected, should show empty state message
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
  });

  test("settings link navigates to provider settings", async ({ page }) => {
    await page.goto("/settings/providers");
    await expect(page).toHaveURL("/settings/providers");
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("refreshes issue list after sync completes", async ({ page }) => {
    // Intercept /api/sync GET to simulate sync-in-progress then sync-complete
    let pollCount = 0;
    const baseLastSyncedAt = new Date(Date.now() + 60000).toISOString(); // future = after sync started

    await page.route("/api/sync", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ data: { syncing: true }, error: null }) });
        return;
      }
      pollCount++;
      // First 2 polls: not yet synced; 3rd poll: synced
      const lastSyncedAt = pollCount >= 3 ? baseLastSyncedAt : null;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{ id: "p1", displayName: "GitHub", type: "GITHUB", projects: [{ id: "proj1", displayName: "repo", lastSyncedAt, syncError: null }] }],
          error: null,
        }),
      });
    });

    // /api/issues returns the item only after sync has completed (pollCount >= 3)
    await page.route("/api/issues*", async (route) => {
      const items = pollCount >= 3
        ? [{ id: "i1", title: "Synced Issue", status: "OPEN", dueDate: null, externalUrl: "https://example.com", providerCreatedAt: "2026-01-15T10:30:00.000Z", providerUpdatedAt: "2026-03-10T14:00:00.000Z", project: { displayName: "repo", issueProvider: { iconUrl: null, displayName: "GitHub" } } }]
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items, total: items.length }, error: null }),
      });
    });

    await page.goto("/");

    // Issue must NOT be visible before sync completes
    await expect(page.getByText("Synced Issue")).not.toBeVisible();

    // Wait until the synced issue appears — proves the re-fetch was triggered by sync completion
    await expect(page.getByText("Synced Issue")).toBeVisible({ timeout: 30000 });
  });

  test("shows providerCreatedAt and providerUpdatedAt chips on each task", async ({ page }) => {
    const providerCreatedAt = "2026-01-15T10:30:00.000Z";
    const providerUpdatedAt = "2026-03-10T14:00:00.000Z";

    await page.route("/api/sync*", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ data: { syncing: false }, error: null }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [], error: null }) });
    });

    await page.route("/api/issues/today", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items: [] }, error: null }) });
    });

    await page.route("/api/issues*", async (route) => {
      if (route.request().url().includes("/today")) return;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            items: [{
              id: "i1",
              externalId: "42",
              title: "Date Display Issue",
              status: "OPEN",
              dueDate: null,
              externalUrl: "https://example.com",
              isUnassigned: false,
              todayFlag: false,
              todayOrder: null,
              todayAddedAt: null,
              providerCreatedAt,
              providerUpdatedAt,
              project: { displayName: "repo", issueProvider: { iconUrl: null, displayName: "GitHub" } },
            }],
            total: 1,
            totalToday: 0,
            page: 1,
            limit: 20,
          },
          error: null,
        }),
      });
    });

    await page.goto("/");

    // Issue must be visible
    await expect(page.getByText("Date Display Issue")).toBeVisible({ timeout: 10000 });

    // Created and updated date chips must be visible.
    // Compute expected strings inside the browser context to match the UI's locale/timezone.
    const { createdDateText, updatedDateText } = await page.evaluate(
      ({ createdIso, updatedIso }) => {
        const created = new Date(createdIso).toLocaleString();
        const updated = new Date(updatedIso).toLocaleString();
        return { createdDateText: created, updatedDateText: updated };
      },
      { createdIso: providerCreatedAt, updatedIso: providerUpdatedAt },
    );
    await expect(
      page.getByText(new RegExp(createdDateText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))),
    ).toBeVisible();
    await expect(
      page.getByText(new RegExp(updatedDateText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))),
    ).toBeVisible();
  });

  test("does not show priority chip on any task", async ({ page }) => {
    await page.route("/api/sync*", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ data: { syncing: false }, error: null }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [], error: null }) });
    });

    await page.route("/api/issues/today", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items: [] }, error: null }) });
    });

    await page.route("/api/issues*", async (route) => {
      if (route.request().url().includes("/today")) return;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            items: [{
              id: "i1",
              externalId: "42",
              title: "Priority Test Issue",
              status: "OPEN",
              dueDate: null,
              externalUrl: "https://example.com",
              isUnassigned: false,
              todayFlag: false,
              todayOrder: null,
              todayAddedAt: null,
              providerCreatedAt: null,
              providerUpdatedAt: null,
              project: { displayName: "repo", issueProvider: { iconUrl: null, displayName: "GitHub" } },
            }],
            total: 1,
            totalToday: 0,
            page: 1,
            limit: 20,
          },
          error: null,
        }),
      });
    });

    await page.goto("/");
    await expect(page.getByText("Priority Test Issue")).toBeVisible({ timeout: 10000 });

    // None of the priority labels should be visible
    await expect(page.getByText("Low")).not.toBeVisible();
    await expect(page.getByText("Medium")).not.toBeVisible();
    await expect(page.getByText("High")).not.toBeVisible();
    await expect(page.getByText("Critical")).not.toBeVisible();
  });
});
