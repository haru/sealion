/** @jest-environment node */
/**
 * Unit tests for the admin layout guard (spec 045, FR-006).
 * A revoked, expired or unauthenticated visitor is sent to /login; a signed-in non-admin sees the 403 page.
 */

const mockRedirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockAuth = jest.fn();

jest.mock("next/navigation", () => ({ redirect: (url: string) => mockRedirect(url) }));
jest.mock("next-intl/server", () => ({ getTranslations: jest.fn().mockResolvedValue((key: string) => key) }));
jest.mock("@/lib/auth/auth", () => ({ auth: () => mockAuth() }));
jest.mock("@/components/layout/DashboardShell", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/admin/AdminSessionProvider", () => ({ AdminSessionProvider: () => null }));

import AdminLayout from "@/app/admin/layout";

describe("AdminLayout", () => {
  beforeEach(() => jest.clearAllMocks());

  it("redirects to /login when the session is null (revoked, expired or signed out)", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(AdminLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when the session has no user", async () => {
    mockAuth.mockResolvedValue({ expires: "x" });

    await expect(AdminLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("shows the 403 page to a signed-in non-admin, without redirecting", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", email: "u@ex.com", role: "USER" } });

    const element = await AdminLayout({ children: null });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(JSON.stringify(element)).toContain("forbiddenTitle");
  });

  it("renders the admin shell for an admin, without redirecting", async () => {
    mockAuth.mockResolvedValue({ user: { id: "a1", email: "a@ex.com", role: "ADMIN", useGravatar: false } });

    const element = await AdminLayout({ children: null });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(JSON.stringify(element)).not.toContain("forbiddenTitle");
  });
});
