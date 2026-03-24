import { test, expect, type Page } from "@playwright/test";

const LOGIN_EMAIL = process.env.E2E_USER_EMAIL ?? "admin@example.com";
const LOGIN_PASSWORD = process.env.E2E_USER_PASSWORD ?? "password123";

const TODAY_ITEMS = [
  {
    id: "today-1",
    externalId: "#1",
    title: "First today task",
    status: "OPEN",
    dueDate: null,
    providerCreatedAt: null,
    providerUpdatedAt: null,
    externalUrl: "https://example.com/1",
    isUnassigned: false,
    todayFlag: true,
    todayOrder: 1,
    todayAddedAt: new Date().toISOString(),
    project: {
      displayName: "repo",
      issueProvider: { iconUrl: null, displayName: "GitHub" },
    },
  },
  {
    id: "today-2",
    externalId: "#2",
    title: "Second today task",
    status: "OPEN",
    dueDate: null,
    providerCreatedAt: null,
    providerUpdatedAt: null,
    externalUrl: "https://example.com/2",
    isUnassigned: false,
    todayFlag: true,
    todayOrder: 2,
    todayAddedAt: new Date().toISOString(),
    project: {
      displayName: "repo",
      issueProvider: { iconUrl: null, displayName: "GitHub" },
    },
  },
];

/** Registers API route mocks for the dashboard page. */
async function setupMocks(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/api/sync")) {
      if (method === "POST") {
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({ data: { syncing: true }, error: null }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [], error: null }),
        });
      }
    } else if (url.includes("/api/issues/today/reorder")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { success: true }, error: null }),
      });
    } else if (/\/api\/issues\/today(\?|$)/.test(url) && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items: TODAY_ITEMS }, error: null }),
      });
    } else if (/\/api\/issues\/[^?/]+$/.test(url) && method === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { todayFlag: false, todayOrder: null }, error: null }),
      });
    } else if (url.includes("/api/issues")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [], total: 0 }, error: null }),
      });
    } else {
      await route.fallback();
    }
  });
}

/** Logs in and waits for the dashboard to load. */
async function login(page: Page) {
  await page.goto("/login");
  await page.fill('[name="email"]', LOGIN_EMAIL);
  await page.fill('[name="password"]', LOGIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
}

/**
 * Presses the pointer down on the drag handle of a today-item at `index`
 * and moves slightly to activate dnd-kit's PointerSensor.
 *
 * @param page - Playwright page.
 * @param index - Zero-based index of the today-item drag handle.
 * @returns Center coordinates of the drag handle.
 */
async function startDragOnTodayItem(page: Page, index: number) {
  const handles = page.locator('[data-testid="DragIndicatorIcon"]');
  const handle = handles.nth(index);
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error(`Drag handle at index ${index} not found`);

  const cx = handleBox.x + handleBox.width / 2;
  const cy = handleBox.y + handleBox.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  // Small movement to activate the PointerSensor
  await page.mouse.move(cx + 5, cy + 5, { steps: 3 });

  return { cx, cy };
}

test.describe("Today Tasks Drag and Drop", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await login(page);
    await page.waitForSelector("text=First today task");
    await page.waitForSelector("text=Second today task");
  });

  // ── User Story 1: Card follows cursor during drag ──────────────────────────

  test("T003: DragOverlay card appears near pointer during drag", async ({ page }) => {
    await startDragOnTodayItem(page, 0);

    // With DragOverlay rendering a full IssueCard, the dragged item's title
    // should appear twice: once as the ghost and once in the overlay.
    const titleElements = page.locator("text=#1 First today task");
    await expect(titleElements).toHaveCount(2, { timeout: 3000 });

    await page.mouse.up();
  });

  test("T004: original card shows ghost (low opacity) during drag", async ({ page }) => {
    const cards = page.locator(".MuiCard-root");
    const firstCard = cards.first();

    await startDragOnTodayItem(page, 0);

    // After the isGhost prop is applied, the original card renders with opacity 0.15.
    // Before the fix it is 0.6 (isDragging only), so checking < 0.2 gates on the new behaviour.
    const opacity = await firstCard.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).opacity)
    );
    expect(opacity).toBeLessThan(0.2);

    await page.mouse.up();
  });

  test("T005: drag today-item to new position updates order", async ({ page }) => {
    const handles = page.locator('[data-testid="DragIndicatorIcon"]');

    const firstHandleBox = await handles.nth(0).boundingBox();
    const secondHandleBox = await handles.nth(1).boundingBox();
    if (!firstHandleBox || !secondHandleBox) throw new Error("Drag handles not found");

    // Drag first item past the bottom of the second item to place it after it.
    await page.mouse.move(
      firstHandleBox.x + firstHandleBox.width / 2,
      firstHandleBox.y + firstHandleBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      secondHandleBox.x + secondHandleBox.width / 2,
      secondHandleBox.y + secondHandleBox.height + 10,
      { steps: 25 }
    );
    await page.mouse.up();

    // "Second today task" should now precede "First today task" in the list.
    // Wait until the second card appears before the first in the DOM.
    await expect(async () => {
      const allCardTexts = await page.locator(".MuiCard-root").allTextContents();
      const firstIdx = allCardTexts.findIndex((t) => t.includes("First today task"));
      const secondIdx = allCardTexts.findIndex((t) => t.includes("Second today task"));
      expect(secondIdx).toBeLessThan(firstIdx);
    }).toPass({ timeout: 3000 });
  });

  // ── User Story 2: Drop outside today area removes item ────────────────────

  test("T012: dropping today-item outside today area removes it from list", async ({ page }) => {
    const { cx, cy } = await startDragOnTodayItem(page, 0);

    // Drop far below the today area (outside the droppable Paper).
    await page.mouse.move(cx, cy + 600, { steps: 30 });
    await page.mouse.up();

    // "First today task" should be removed by the optimistic state update.
    await expect(page.locator("text=First today task")).toHaveCount(0, { timeout: 3000 });
    // "Second today task" must remain.
    await expect(page.locator("text=Second today task")).toBeVisible();
  });

  test("T013: item removed from today still appears in regular issue list", async ({ page }) => {
    let patchCalled = false;

    // Override the regular issues GET to return the item once the PATCH fires,
    // simulating the server confirming the todayFlag was cleared.
    await page.route(/\/api\/issues\?page=/, async (route) => {
      const items = patchCalled
        ? [{ ...TODAY_ITEMS[0], todayFlag: false, todayOrder: null }]
        : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items, total: items.length }, error: null }),
      });
    });

    // Override the specific item PATCH to flip the flag and record the call.
    await page.route(/\/api\/issues\/today-1$/, async (route) => {
      if (route.request().method() === "PATCH") {
        patchCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { todayFlag: false, todayOrder: null }, error: null }),
        });
      } else {
        await route.fallback();
      }
    });

    const { cx, cy } = await startDragOnTodayItem(page, 0);
    await page.mouse.move(cx, cy + 600, { steps: 30 });
    await page.mouse.up();

    // After removal from today, fetchIssues() is called and the item should
    // reappear in the regular issue list (it was not deleted from the system).
    await expect(page.locator("text=First today task")).toBeVisible({ timeout: 5000 });
  });

  test("T014: DragOverlay shows grayscale filter when dragging outside today area", async ({ page }) => {
    const { cx, cy } = await startDragOnTodayItem(page, 0);

    // Move cursor well outside the today area.
    await page.mouse.move(cx, cy + 600, { steps: 20 });

    // When isDraggingOutside is true, the overlay Box has filter: grayscale(80%).
    // Walk up the DOM from each card containing the dragged issue title to find
    // an ancestor element with the grayscale filter in its computed style.
    const grayscaleApplied = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".MuiCard-root")).filter(
        (el) => el.textContent?.includes("First today task")
      );
      for (const card of cards) {
        let parent = card.parentElement;
        while (parent && parent !== document.body) {
          if (window.getComputedStyle(parent).filter.includes("grayscale")) return true;
          parent = parent.parentElement;
        }
      }
      return false;
    });

    expect(grayscaleApplied).toBe(true);

    await page.mouse.up();
  });
});
