import { ADMIN_PARENT, PAGE_ROUTES, getPageRoute } from "@/lib/ui/page-routes";

describe("PAGE_ROUTES", () => {
  it("contains an entry for every known dashboard/admin route", () => {
    const paths = PAGE_ROUTES.map((r) => r.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/projects");
    expect(paths).toContain("/settings/board");
    expect(paths).toContain("/settings/profile");
    expect(paths).toContain("/settings/providers");
    expect(paths).toContain("/admin/users");
    expect(paths).toContain("/admin/auth-settings");
    expect(paths).toContain("/admin/smtp-settings");
    expect(paths).toContain("/admin/auth-providers");
  });

  it("has no duplicate paths", () => {
    const paths = PAGE_ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("every route has a non-null icon component", () => {
    for (const route of PAGE_ROUTES) {
      expect(route.icon).toBeDefined();
      expect(route.icon).toBeTruthy();
    }
  });

  it("every route has a non-empty titleNamespace and titleKey", () => {
    for (const route of PAGE_ROUTES) {
      expect(route.titleNamespace).toBeTruthy();
      expect(route.titleKey).toBeTruthy();
    }
  });

  it("every route has a non-empty sidebarLabelKey", () => {
    for (const route of PAGE_ROUTES) {
      expect(route.sidebarLabelKey).toBeTruthy();
    }
  });

  it("admin routes have breadcrumbParent set to ADMIN_PARENT", () => {
    for (const route of PAGE_ROUTES) {
      if (route.path.startsWith("/admin")) {
        expect(route.breadcrumbParent).toBe(ADMIN_PARENT);
      }
    }
  });

  it("non-admin routes do not have breadcrumbParent", () => {
    for (const route of PAGE_ROUTES) {
      if (!route.path.startsWith("/admin")) {
        expect(route.breadcrumbParent).toBeUndefined();
      }
    }
  });
});

describe("ADMIN_PARENT", () => {
  it("has the correct path", () => {
    expect(ADMIN_PARENT.path).toBe("/admin");
  });

  it("has a sidebarLabelKey of systemAdmin", () => {
    expect(ADMIN_PARENT.sidebarLabelKey).toBe("systemAdmin");
  });
});

describe("getPageRoute", () => {
  it("returns the correct route for a known path", () => {
    const route = getPageRoute("/projects");
    expect(route).toBeDefined();
    expect(route!.path).toBe("/projects");
    expect(route!.titleNamespace).toBe("projects");
  });

  it("returns undefined for an unknown path", () => {
    expect(getPageRoute("/nonexistent")).toBeUndefined();
  });

  it("returns the admin auth-providers route with KeyIcon-equivalent icon", () => {
    const route = getPageRoute("/admin/auth-providers");
    expect(route).toBeDefined();
    expect(route!.breadcrumbParent).toBe(ADMIN_PARENT);
  });
});
