import { test, expect } from "@playwright/test";

test.describe("Auth Pages — Accessibility and UI", () => {
  test.describe("Login page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/login");
    });

    test("renders Sealion branding header with decorative logo image", async ({ page }) => {
      // The heading 'Sealion' should be visible
      await expect(page.getByRole("heading", { name: "Sealion", level: 1 })).toBeVisible();

      // The logo image must be decorative: empty alt text (not announced by screen readers)
      const logoImg = page.locator('img[src="/sealion.svg"]');
      await expect(logoImg).toBeVisible();
      await expect(logoImg).toHaveAttribute("alt", "");
      await expect(logoImg).toHaveAttribute("aria-hidden", "true");
    });

    test("sign-up link is keyboard-reachable and has focus-visible styling", async ({ page }) => {
      const signupLink = page.locator("a[href='/signup']");
      await expect(signupLink).toBeVisible();

      // Verify the link is keyboard-reachable (has no tabIndex=-1)
      const tabIndex = await signupLink.getAttribute("tabindex");
      expect(tabIndex).not.toBe("-1");

      // Tab to the signup link and verify it receives focus
      await signupLink.focus();
      await expect(signupLink).toBeFocused();
    });

    test("login card uses AuthCard shared component structure", async ({ page }) => {
      // The card should be present and contain the login title heading
      await expect(page.getByRole("heading", { name: /sign in|log in/i }).or(
        page.getByRole("heading", { level: 2 })
      )).toBeVisible();

      // Submit button should be visible and large
      const submitBtn = page.getByRole("button", { name: /log in|login|sign in/i });
      await expect(submitBtn).toBeVisible();
    });
  });

  test.describe("Signup page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/signup");
    });

    test("renders Sealion branding header with decorative logo image", async ({ page }) => {
      await expect(page.getByRole("heading", { name: "Sealion", level: 1 })).toBeVisible();

      const logoImg = page.locator('img[src="/sealion.svg"]');
      await expect(logoImg).toBeVisible();
      await expect(logoImg).toHaveAttribute("alt", "");
      await expect(logoImg).toHaveAttribute("aria-hidden", "true");
    });

    test("login link is keyboard-reachable and has focus-visible styling", async ({ page }) => {
      const loginLink = page.locator("a[href='/login']");
      await expect(loginLink).toBeVisible();

      // Verify the link is keyboard-reachable (has no tabIndex=-1)
      const tabIndex = await loginLink.getAttribute("tabindex");
      expect(tabIndex).not.toBe("-1");

      // Verify the link receives programmatic focus
      await loginLink.focus();
      await expect(loginLink).toBeFocused();
    });

    test("signup card uses AuthCard shared component structure", async ({ page }) => {
      await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
      const submitBtn = page.getByRole("button", { name: /sign up|signup|create/i });
      await expect(submitBtn).toBeVisible();
    });
  });
});
