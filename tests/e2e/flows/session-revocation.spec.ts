/**
 * E2E: session revocation and idle-timeout wiring (spec 045).
 *
 * Needs a running app and the seeded admin (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD, same as the
 * other admin specs). The idle timeout itself cannot be fast-forwarded from the browser because
 * it is judged on the server clock; that rule is covered by
 * tests/integration/auth/session-revocation.test.ts.
 */
import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "password123";
const USER_PASSWORD = "password123";
const RUN_ID = Date.now();

type Role = "USER" | "ADMIN";

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL("/");
}

async function newLoggedInContext(browser: Browser, email: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginViaUi(page, email, password);
  return { context, page };
}

/** Creates a user through the admin API and returns its id and email. */
async function createUser(admin: Page, label: string, role: Role) {
  const email = `e2e-${label}-${RUN_ID}@example.com`;
  const res = await admin.request.post("/api/admin/users", {
    data: { email, password: USER_PASSWORD, confirmPassword: USER_PASSWORD, username: label, role },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { data: { id: string } };
  return { id: body.data.id, email };
}

test.describe("Session revocation (spec 045)", () => {
  let adminContext: BrowserContext;
  let admin: Page;
  const createdIds: string[] = [];

  test.beforeEach(async ({ browser }) => {
    ({ context: adminContext, page: admin } = await newLoggedInContext(browser, ADMIN_EMAIL, ADMIN_PASSWORD));
  });

  test.afterEach(async () => {
    for (const id of createdIds.splice(0)) {
      await admin.request.delete(`/api/admin/users/${id}`);
    }
    await adminContext.close();
  });

  test("US1: a demoted admin loses access on the very next request", async ({ browser }) => {
    const b = await createUser(admin, "demoted-admin", "ADMIN");
    createdIds.push(b.id);
    const { context, page } = await newLoggedInContext(browser, b.email, USER_PASSWORD);
    await page.goto("/admin/users");
    await expect(page.locator(".MuiDataGrid-root")).toBeVisible({ timeout: 10000 });

    const patch = await admin.request.patch(`/api/admin/users/${b.id}`, { data: { role: "USER" } });
    expect(patch.status()).toBe(200);

    expect((await page.request.get("/api/admin/users")).status()).toBe(401);
    // Use a fresh page: the old one may already be redirecting itself after its API call got a 401.
    const fresh = await context.newPage();
    await fresh.goto("/admin/users");
    await expect(fresh).toHaveURL(/\/login/);
    await context.close();
  });

  test("US2: a suspended user is sent to the login page", async ({ browser }) => {
    const u = await createUser(admin, "suspended-user", "USER");
    createdIds.push(u.id);
    const { context, page } = await newLoggedInContext(browser, u.email, USER_PASSWORD);

    const patch = await admin.request.patch(`/api/admin/users/${u.id}`, { data: { status: "SUSPENDED" } });
    expect(patch.status()).toBe(200);

    expect((await page.request.get("/api/issues")).status()).toBe(401);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test("US3: changing your own password keeps this browser and ends every other session", async ({ browser }) => {
    const u = await createUser(admin, "password-user", "USER");
    createdIds.push(u.id);
    const x = await newLoggedInContext(browser, u.email, USER_PASSWORD);
    const y = await newLoggedInContext(browser, u.email, USER_PASSWORD);
    const newPassword = "newpassword456";

    await x.page.goto("/settings/profile");
    await x.page.click('[data-testid="profile-change-password-checkbox"]');
    await x.page.fill('[data-testid="profile-current-password"] input', USER_PASSWORD);
    await x.page.fill('[data-testid="profile-new-password"] input', newPassword);
    await x.page.fill('[data-testid="profile-confirm-password"] input', newPassword);
    await x.page.click('[data-testid="profile-save-button"]');

    // The other browser is signed out; this one keeps working without a login prompt.
    await expect.poll(async () => (await y.page.request.get("/api/issues")).status()).toBe(401);
    await expect.poll(async () => (await x.page.request.get("/api/issues")).status()).toBe(200);
    await x.page.goto("/");
    await expect(x.page).not.toHaveURL(/\/login/);

    await x.context.close();
    await y.context.close();
  });

  test("US3: an admin-set password ends the user's sessions", async ({ browser }) => {
    const u = await createUser(admin, "reset-user", "USER");
    createdIds.push(u.id);
    const { context, page } = await newLoggedInContext(browser, u.email, USER_PASSWORD);

    const patch = await admin.request.patch(`/api/admin/users/${u.id}`, {
      data: { changePassword: true, password: "adminset12345" },
    });
    expect(patch.status()).toBe(200);

    expect((await page.request.get("/api/issues")).status()).toBe(401);
    await context.close();
  });

  test("US4: real input is reported to the session so the idle timeout counts it", async ({ browser }) => {
    const u = await createUser(admin, "active-user", "USER");
    createdIds.push(u.id);
    const { context, page } = await newLoggedInContext(browser, u.email, USER_PASSWORD);

    // The first keystrokes can land before the session provider has finished loading, in which
    // case nothing is sent and the next input retries. Keep typing until the report appears.
    await expect(async () => {
      const report = page.waitForRequest(
        (req) => req.url().includes("/api/auth/session") && req.method() === "POST",
        { timeout: 2000 },
      );
      await page.keyboard.press("a");
      await report;
    }).toPass({ timeout: 20000 });

    await context.close();
  });
});
