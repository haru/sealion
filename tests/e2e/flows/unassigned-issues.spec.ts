import { test, expect } from "@playwright/test";

test.describe("Unassigned Issues", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', process.env.E2E_USER_EMAIL ?? "admin@example.com");
    await page.fill('[name="password"]', process.env.E2E_USER_PASSWORD ?? "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  test("project list shows includeUnassigned toggle column", async ({ page }) => {
    await page.goto("/settings/projects");
    await expect(page.getByText("Include unassigned issues")).toBeVisible();
  });

  test("unassigned issue chip is visible on TODO list when isUnassigned is true", async ({ page }) => {
    // Intercept GET /api/issues to inject an unassigned issue
    await page.route("/api/issues*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            items: [
              {
                id: "test-unassigned-1",
                externalId: "99",
                title: "Unassigned bug to fix",
                status: "OPEN",
                dueDate: null,
                providerCreatedAt: null,
                providerUpdatedAt: null,
                externalUrl: "https://github.com/owner/repo/issues/99",
                isUnassigned: true,
                project: {
                  displayName: "owner/repo",
                  issueProvider: { iconUrl: null, displayName: "My GitHub" },
                },
              },
              {
                id: "test-assigned-1",
                externalId: "100",
                title: "My assigned issue",
                status: "OPEN",
                dueDate: null,
                providerCreatedAt: null,
                providerUpdatedAt: null,
                externalUrl: "https://github.com/owner/repo/issues/100",
                isUnassigned: false,
                project: {
                  displayName: "owner/repo",
                  issueProvider: { iconUrl: null, displayName: "My GitHub" },
                },
              },
            ],
            total: 2,
            page: 1,
            limit: 20,
          },
        }),
      });
    });

    await page.goto("/");
    await page.waitForSelector('[data-testid="todo-item"], .MuiCard-root', { timeout: 5000 }).catch(() => null);

    // The unassigned chip should be visible for the unassigned issue
    await expect(page.getByText("Unassigned")).toBeVisible();
  });

  test("assigned issue does not show unassigned chip", async ({ page }) => {
    await page.route("/api/issues*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            items: [
              {
                id: "test-assigned-2",
                externalId: "101",
                title: "Only assigned issue",
                status: "OPEN",
                dueDate: null,
                providerCreatedAt: null,
                providerUpdatedAt: null,
                externalUrl: "https://github.com/owner/repo/issues/101",
                isUnassigned: false,
                project: {
                  displayName: "owner/repo",
                  issueProvider: { iconUrl: null, displayName: "My GitHub" },
                },
              },
            ],
            total: 1,
            page: 1,
            limit: 20,
          },
        }),
      });
    });

    await page.goto("/");
    await page.waitForSelector('[data-testid="todo-item"], .MuiCard-root', { timeout: 5000 }).catch(() => null);

    // Only assigned issue — "Unassigned" chip should NOT be present
    await expect(page.getByText("Unassigned")).not.toBeVisible();
  });

  test("unassigned chip tooltip shows on hover", async ({ page }) => {
    await page.route("/api/issues*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            items: [
              {
                id: "test-unassigned-2",
                externalId: "102",
                title: "Issue without assignee",
                status: "OPEN",
                dueDate: null,
                providerCreatedAt: null,
                providerUpdatedAt: null,
                externalUrl: "https://github.com/owner/repo/issues/102",
                isUnassigned: true,
                project: {
                  displayName: "owner/repo",
                  issueProvider: { iconUrl: null, displayName: "My GitHub" },
                },
              },
            ],
            total: 1,
            page: 1,
            limit: 20,
          },
        }),
      });
    });

    await page.goto("/");
    await page.waitForSelector('[data-testid="todo-item"], .MuiCard-root', { timeout: 5000 }).catch(() => null);

    const chip = page.getByText("Unassigned");
    await expect(chip).toBeVisible();
    await chip.hover();
    // MUI Tooltip renders into a portal — check for tooltip text
    await expect(page.getByRole("tooltip", { name: "No assignee" })).toBeVisible({ timeout: 3000 });
  });
});
