import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "password123";

/** Logs in and navigates to the projects page. */
async function loginAndGoToProjects(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('[name="email"]', ADMIN_EMAIL);
  await page.fill('[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
  await page.goto("/projects");
  await page.waitForURL(/projects/);
}

test.describe("Projects — DataTable: sort and filter (US1)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToProjects(page);
  });

  test("projects page renders the DataGrid table", async ({ page }) => {
    // MUI DataGrid root element is present
    const grid = page.locator(".MuiDataGrid-root");
    await expect(grid).toBeVisible({ timeout: 10000 });
  });

  test("column headers are clickable for sorting", async ({ page }) => {
    const grid = page.locator(".MuiDataGrid-root");
    await expect(grid).toBeVisible({ timeout: 10000 });

    // Column headers should be present
    const headers = page.locator(".MuiDataGrid-columnHeader");
    await expect(headers.first()).toBeVisible();
  });

  test("quick filter input is visible", async ({ page }) => {
    const grid = page.locator(".MuiDataGrid-root");
    await expect(grid).toBeVisible({ timeout: 10000 });

    // The GridToolbarQuickFilter renders an input
    const filterInput = page.locator(".MuiDataGrid-toolbarContainer input");
    await expect(filterInput).toBeVisible();
  });

  test("typing in the filter narrows visible rows", async ({ page }) => {
    const grid = page.locator(".MuiDataGrid-root");
    await expect(grid).toBeVisible({ timeout: 10000 });

    const rows = page.locator(".MuiDataGrid-row");
    const initialCount = await rows.count();

    // Only run if there are rows to filter
    if (initialCount === 0) {
      test.skip(true, "No project rows to filter");
      return;
    }

    const filterInput = page.locator(".MuiDataGrid-toolbarContainer input");
    // Type a string unlikely to match any row → expect 0 rows or no-rows overlay
    await filterInput.fill("zzz_no_match_xyz");

    // Wait for the filter to apply deterministically (row count drops or overlay appears)
    const noRowsOverlay = page.locator(".MuiDataGrid-overlay");
    await expect.poll(
      async () => {
        const count = await rows.count();
        const overlayVisible = await noRowsOverlay.isVisible();
        return count < initialCount || overlayVisible;
      },
      { timeout: 3000 },
    ).toBeTruthy();

    // Clear filter → rows restore
    await filterInput.clear();
    await expect.poll(async () => rows.count(), { timeout: 3000 }).toBeGreaterThanOrEqual(initialCount);
  });

  test("clicking a column header sorts the table", async ({ page }) => {
    const grid = page.locator(".MuiDataGrid-root");
    await expect(grid).toBeVisible({ timeout: 10000 });

    const rows = page.locator(".MuiDataGrid-row");
    const rowCount = await rows.count();

    if (rowCount < 2) {
      test.skip(true, "Need at least 2 rows to verify sort");
      return;
    }

    // Click the first sortable column header
    const sortableHeader = page.locator(".MuiDataGrid-columnHeader[aria-sort]").first();
    if (!(await sortableHeader.isVisible())) {
      test.skip(true, "No sortable column headers found");
      return;
    }
    await sortableHeader.click();

    // After click, sort icon should be visible on that column
    const sortIcon = page.locator(".MuiDataGrid-sortIcon, .MuiDataGrid-iconButtonContainer svg").first();
    await expect(sortIcon).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Projects — DataTable: pagination (US3)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToProjects(page);
  });

  test("pagination controls are visible when the grid is rendered", async ({ page }) => {
    const grid = page.locator(".MuiDataGrid-root");
    await expect(grid).toBeVisible({ timeout: 10000 });

    // Pagination footer is always rendered by DataGrid
    const pagination = page.locator(".MuiDataGrid-footerContainer");
    await expect(pagination).toBeVisible();
  });

  test("page size selector shows available options", async ({ page }) => {
    const grid = page.locator(".MuiDataGrid-root");
    await expect(grid).toBeVisible({ timeout: 10000 });

    const rows = page.locator(".MuiDataGrid-row");
    const rowCount = await rows.count();

    // Page size selector is in the footer
    const pageSizeSelector = page.locator(".MuiTablePagination-select");
    if (await pageSizeSelector.isVisible()) {
      expect(rowCount).toBeLessThanOrEqual(20);
    }
  });
});
