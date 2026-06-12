import { test, expect, type Page } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL ?? "admin@example.com";
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? "password123";

async function loginAndGoToProviders(page: Page): Promise<void> {
  await page.goto("/login");
  await page.fill('[name="email"]', E2E_EMAIL);
  await page.fill('[name="password"]', E2E_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
  await page.goto("/settings/providers");
}

async function openAddProviderDialog(page: Page): Promise<void> {
  await page.getByRole("button", { name: /add issue tracker/i }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
}

async function selectGitHubProvider(page: Page): Promise<void> {
  await page.getByLabel(/type/i).click();
  await page.getByRole("option", { name: /github/i }).click();
}

// ---------------------------------------------------------------------------
// US1: GitHub Enterprise registration
// ---------------------------------------------------------------------------

test.describe("US1 — GHE provider registration", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToProviders(page);
  });

  test("GHE checkbox is visible when GitHub is selected", async ({ page }) => {
    await openAddProviderDialog(page);
    await selectGitHubProvider(page);
    await expect(page.getByLabel(/self-hosted.*enterprise/i)).toBeVisible();
  });

  test("URL field is disabled when GHE checkbox is unchecked", async ({ page }) => {
    await openAddProviderDialog(page);
    await selectGitHubProvider(page);
    const urlField = page.getByLabel(/server url/i).first();
    await expect(urlField).toBeDisabled();
  });

  test("URL field becomes enabled when GHE checkbox is checked", async ({ page }) => {
    await openAddProviderDialog(page);
    await selectGitHubProvider(page);
    await page.getByLabel(/self-hosted.*enterprise/i).click();
    const urlField = page.getByLabel(/server url/i).first();
    await expect(urlField).toBeEnabled();
  });

  test("registering GHE provider stores baseUrl (checkbox ON)", async ({ page }) => {
    const createdProviders: unknown[] = [];

    await page.route("**/api/providers", (route) => {
      if (route.request().method() === "POST") {
        const body = JSON.parse(route.request().postData() ?? "{}") as {
          credentials?: { baseUrl?: string };
        };
        createdProviders.push(body);
        void route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "ghe-provider-id",
              type: "GITHUB",
              displayName: "Acme GHE",
              baseUrl: body.credentials?.baseUrl ?? null,
              createdAt: new Date().toISOString(),
              iconUrl: "/providers/github.svg",
            },
          }),
        });
      } else {
        void route.continue();
      }
    });

    await openAddProviderDialog(page);
    await selectGitHubProvider(page);
    await page.fill('[data-testid="provider-name-input"]', "Acme GHE");
    await page.getByLabel(/self-hosted.*enterprise/i).click();
    await page.getByLabel(/server url/i).first().fill("https://github.example.com");
    await page.fill('[data-testid="token-input"]', "ghp_enterprise_token");
    await page.getByRole("button", { name: /add issue tracker/i }).click();

    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    expect(createdProviders).toHaveLength(1);
    const posted = createdProviders[0] as { credentials?: { baseUrl?: string } };
    expect(posted.credentials?.baseUrl).toBe("https://github.example.com");
  });

  test("registering github.com provider stores null baseUrl (checkbox OFF)", async ({ page }) => {
    const createdProviders: unknown[] = [];

    await page.route("**/api/providers", (route) => {
      if (route.request().method() === "POST") {
        const body = JSON.parse(route.request().postData() ?? "{}") as object;
        createdProviders.push(body);
        void route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "gh-provider-id",
              type: "GITHUB",
              displayName: "My GitHub",
              baseUrl: null,
              createdAt: new Date().toISOString(),
              iconUrl: "/providers/github.svg",
            },
          }),
        });
      } else {
        void route.continue();
      }
    });

    await openAddProviderDialog(page);
    await selectGitHubProvider(page);
    await page.fill('[data-testid="provider-name-input"]', "My GitHub");
    await page.fill('[data-testid="token-input"]', "ghp_token");
    await page.getByRole("button", { name: /add issue tracker/i }).click();

    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    expect(createdProviders).toHaveLength(1);
    const posted = createdProviders[0] as { credentials?: { baseUrl?: string } };
    expect(posted.credentials?.baseUrl).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// US2: URL format validation
// ---------------------------------------------------------------------------

test.describe("US2 — GHE URL format validation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToProviders(page);
  });

  test("shows inline error for invalid URL (no scheme)", async ({ page }) => {
    await openAddProviderDialog(page);
    await selectGitHubProvider(page);
    await page.getByLabel(/self-hosted.*enterprise/i).click();
    await page.getByLabel(/server url/i).first().fill("notaurl");
    await page.getByLabel(/server url/i).first().blur();
    await expect(page.getByText(/valid url/i)).toBeVisible();
  });

  test("shows inline error for ftp:// scheme", async ({ page }) => {
    await openAddProviderDialog(page);
    await selectGitHubProvider(page);
    await page.getByLabel(/self-hosted.*enterprise/i).click();
    await page.getByLabel(/server url/i).first().fill("ftp://example.com");
    await page.getByLabel(/server url/i).first().blur();
    await expect(page.getByText(/valid url/i)).toBeVisible();
  });

  test("error clears when a valid URL is entered", async ({ page }) => {
    await openAddProviderDialog(page);
    await selectGitHubProvider(page);
    await page.getByLabel(/self-hosted.*enterprise/i).click();
    const urlField = page.getByLabel(/server url/i).first();
    await urlField.fill("notaurl");
    await urlField.blur();
    await expect(page.getByText(/valid url/i)).toBeVisible();
    await urlField.fill("https://github.example.com");
    await urlField.blur();
    await expect(page.getByText(/valid url/i)).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// US3: Edit GHE provider
// ---------------------------------------------------------------------------

test.describe("US3 — GHE provider edit and toggle", () => {
  const GHE_PROVIDER = {
    id: "p-ghe",
    type: "GITHUB",
    displayName: "Acme GHE",
    baseUrl: "https://github.example.com",
    iconUrl: "/providers/github.svg",
  };

  test.beforeEach(async ({ page }) => {
    await loginAndGoToProviders(page);
  });

  test("edit modal shows checkbox ON and saved URL for GHE provider", async ({ page }) => {
    await page.route("**/api/providers", (route) => {
      if (route.request().method() === "GET") {
        void route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: [GHE_PROVIDER] }),
        });
      } else {
        void route.continue();
      }
    });

    await page.reload();
    await page.getByRole("button", { name: /edit/i }).first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.getByLabel(/self-hosted.*enterprise/i)).toBeChecked();
    await expect(page.getByLabel(/server url/i).first()).toHaveValue("https://github.example.com");
  });

  test("toggling GHE OFF sends empty baseUrl to PATCH (→ null)", async ({ page }) => {
    const patchBodies: unknown[] = [];

    await page.route("**/api/providers", (route) => {
      if (route.request().method() === "GET") {
        void route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: [GHE_PROVIDER] }),
        });
      } else {
        void route.continue();
      }
    });

    await page.route(`**/api/providers/${GHE_PROVIDER.id}`, (route) => {
      if (route.request().method() === "PATCH") {
        const body = JSON.parse(route.request().postData() ?? "{}") as object;
        patchBodies.push(body);
        void route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { ...GHE_PROVIDER, baseUrl: null },
          }),
        });
      } else {
        void route.continue();
      }
    });

    await page.reload();
    await page.getByRole("button", { name: /edit/i }).first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await page.getByLabel(/self-hosted.*enterprise/i).click(); // toggle OFF
    await page.getByRole("button", { name: /update/i }).click();

    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    expect(patchBodies).toHaveLength(1);
    const patched = patchBodies[0] as { baseUrl?: string };
    expect(patched.baseUrl).toBe("");
  });
});
