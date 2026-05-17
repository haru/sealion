/** @jest-environment node */
/**
 * Verifies that admin route protection covers /admin/auth-providers and
 * /api/admin/auth-providers, both via the page-level authorized callback
 * and via the explicit role check inside middleware.ts for /api/admin/* routes.
 *
 * The NextAuth wrapper in middleware.ts is mocked as a pass-through so that
 * `middleware.default` exposes the real inner handler — meaning these tests
 * will fail if the /api/admin role check is removed from middleware.ts.
 */

// Hoist: mock next-auth before any module imports so middleware.ts sees the stub.
jest.mock("next-auth", () => ({
  __esModule: true,
  // The middleware module calls: const { auth } = NextAuth(authConfig)
  // then: export default auth(innerFn)
  // With this stub auth() is a pass-through, so middleware.default === innerFn.
  default: jest.fn(() => ({
    handlers: {},
    auth: <T>(fn: T) => fn,
    signIn: jest.fn(),
    signOut: jest.fn(),
  })),
}));

import { NextRequest } from "next/server";

import { authConfig } from "@/lib/auth/auth.config";

type AuthorizedFn = (args: {
  auth: { user?: { role?: string } } | null;
  request: { nextUrl: URL };
}) => boolean | Response;

function callAuthorized(role: string | undefined, pathname: string) {
  const fn = authConfig.callbacks!.authorized as AuthorizedFn;
  return fn({
    auth: role ? { user: { role } } : null,
    request: { nextUrl: new URL(`http://localhost:3000${pathname}`) },
  });
}

describe("admin auth-providers — authorized callback (page routes)", () => {
  it("blocks unauthenticated visit to /admin/auth-providers", () => {
    expect(callAuthorized(undefined, "/admin/auth-providers")).toBe(false);
  });

  it("allows ADMIN visit to /admin/auth-providers", () => {
    expect(callAuthorized("ADMIN", "/admin/auth-providers")).toBe(true);
  });

  it("allows USER visit (page-level 403 is enforced by middleware.ts role check)", () => {
    // The authorized callback only enforces *authentication*. The ADMIN role
    // check happens in middleware.ts's wrapper function for /admin/*.
    expect(callAuthorized("USER", "/admin/auth-providers")).toBe(true);
  });
});

describe("admin auth-providers — middleware.ts role check (/api/admin/*)", () => {
  type MiddlewareReq = NextRequest & { auth: { user?: { role?: string } } | null };

  function makeReq(pathname: string, role: string | undefined): MiddlewareReq {
    const req = new NextRequest(`http://localhost:3000${pathname}`) as MiddlewareReq;
    req.auth = role ? { user: { role } } : null;
    return req;
  }

  let middleware: (req: MiddlewareReq) => Response | Promise<Response>;

  beforeAll(async () => {
    const mod = await import("../../../middleware");
    middleware = mod.default as typeof middleware;
  });

  it("returns 403 FORBIDDEN for unauthenticated /api/admin/auth-providers", async () => {
    const res = await middleware(makeReq("/api/admin/auth-providers", undefined));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN");
  });

  it("returns 403 FORBIDDEN for USER role on /api/admin/auth-providers", async () => {
    const res = await middleware(makeReq("/api/admin/auth-providers", "USER"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN");
  });

  it("passes ADMIN through /api/admin/auth-providers", async () => {
    const res = await middleware(makeReq("/api/admin/auth-providers", "ADMIN"));
    expect(res.status).toBe(200);
  });
});
