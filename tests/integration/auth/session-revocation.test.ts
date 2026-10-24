/** @jest-environment node */
/**
 * Integration tests for session revocation and idle timeout (spec 045).
 *
 * Runs the real jwt/session callbacks from src/lib/auth/auth.ts and the real admin
 * users routes against a real database. Only Auth.js itself and the cookie are simulated:
 * `currentToken` plays the role of the browser's session cookie, and `auth()` resolves it
 * through the same callbacks Auth.js would call.
 *
 * Prerequisites: DATABASE_URL pointing at a migrated test DB (npx prisma migrate deploy).
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { NextAuthConfig } from "next-auth";
import { NextRequest } from "next/server";

let capturedCallbacks: NextAuthConfig["callbacks"];

jest.mock("next-auth", () => ({
  __esModule: true,
  default: jest.fn((config: NextAuthConfig | (() => Promise<NextAuthConfig>)) => {
    if (typeof config === "function") {
      void (async () => { capturedCallbacks = (await config()).callbacks; })();
    }
    return { handlers: {}, auth: jest.fn(), signIn: jest.fn(), signOut: jest.fn() };
  }),
}));
jest.mock("next-auth/providers/credentials", () => jest.fn((config: object) => ({ id: "credentials", ...config })));
jest.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: jest.fn(() => ({})) }));
jest.mock("bcryptjs", () => ({ compare: jest.fn().mockResolvedValue(true), hash: jest.fn().mockResolvedValue("hashed") }));
jest.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
  revalidateTag: jest.fn(),
}));
jest.mock("@/services/auth-provider/repository", () => ({
  listEnabled: jest.fn().mockResolvedValue([]),
  AUTH_PROVIDERS_CACHE_TAG: "auth-providers",
}));
jest.mock("@/services/auth-provider", () => ({
  listEnabled: jest.fn().mockResolvedValue([]),
  getAuthProviderMetadata: jest.fn(),
}));
jest.mock("@/lib/auth/auth", () => {
  const actual = jest.requireActual("@/lib/auth/auth");
  return { ...actual, auth: jest.fn() };
});

import { auth } from "@/lib/auth/auth";

const mockAuth = auth as jest.Mock;
const EMAIL_SUFFIX = "@session-revocation.test";

type Token = Record<string, unknown>;
type JwtFn = (args: Record<string, unknown>) => Promise<Token | null>;

let db: PrismaClient;
let dbAvailable = false;
let currentToken: Token | null = null;
let adminId: string;

/** Runs the real jwt callback, then the session callback, like Auth.js `auth()` would. */
async function resolveSession(token: Token | null, trigger?: string, session?: unknown) {
  if (!token) { return { next: null, session: null }; }
  const jwt = capturedCallbacks?.jwt as unknown as JwtFn;
  const next = await jwt({ token, trigger, session, account: null, user: undefined });
  if (!next) { return { next: null, session: null }; }
  const sessionCb = capturedCallbacks?.session as unknown as (a: object) => Promise<{ user: Token }>;
  const out = await sessionCb({ session: { user: {}, expires: "" }, token: next });
  return { next, session: out };
}

/** Simulates a fresh sign-in: Auth.js hands the jwt callback `user` and a token with `sub`. */
async function signInAs(userId: string): Promise<Token> {
  const jwt = capturedCallbacks?.jwt as unknown as JwtFn;
  const next = await jwt({ token: { sub: userId }, user: { id: userId }, trigger: "signIn", account: null });
  if (!next) { throw new Error("sign-in unexpectedly rejected"); }
  return next;
}

async function createUser(name: string, role: "USER" | "ADMIN" = "USER") {
  return db.user.create({
    data: { email: `${name}${EMAIL_SUFFIX}`, passwordHash: "x", role, username: name },
  });
}

function patchRequest(id: string, body: object) {
  return new NextRequest(`http://localhost/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function adminPatch(targetId: string, body: object) {
  mockAuth.mockResolvedValueOnce({ user: { id: adminId, role: "ADMIN" } });
  const { PATCH } = await import("@/app/api/admin/users/[id]/route");
  return PATCH(patchRequest(targetId, body), { params: Promise.resolve({ id: targetId }) });
}

async function adminDelete(targetId: string) {
  mockAuth.mockResolvedValueOnce({ user: { id: adminId, role: "ADMIN" } });
  const { DELETE } = await import("@/app/api/admin/users/[id]/route");
  return DELETE(new NextRequest("http://localhost/x", { method: "DELETE" }), {
    params: Promise.resolve({ id: targetId }),
  });
}

/** Calls GET /api/admin/users as whoever holds `currentToken`. */
async function listUsersAsCookieHolder() {
  mockAuth.mockImplementationOnce(async () => (await resolveSession(currentToken)).session);
  const { GET } = await import("@/app/api/admin/users/route");
  return GET();
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set — skipping session revocation integration tests");
    return;
  }
  try {
    const { Pool } = await import("pg");
    db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
    await db.$connect();
    dbAvailable = true;
  } catch (err) {
    console.warn("DB unavailable — skipping session revocation integration tests", err);
    return;
  }
  await import("@/lib/auth/auth");
  await new Promise((resolve) => setImmediate(resolve));
});

afterAll(async () => {
  if (!dbAvailable) { return; }
  await db.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } });
  await db.authSettings.updateMany({ data: { sessionTimeoutMinutes: null } });
  await db.$disconnect();
});

beforeEach(async () => {
  if (!dbAvailable) { return; }
  jest.clearAllMocks();
  await db.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } });
  await db.authSettings.upsert({
    where: { id: "singleton" },
    update: { sessionTimeoutMinutes: null },
    create: { id: "singleton" },
  });
  adminId = (await createUser("admin-a", "ADMIN")).id;
});

const itDb = (name: string, fn: () => Promise<void>) =>
  it(name, async () => { if (!dbAvailable) { return; } await fn(); });

describe("admin revocation (US1, FR-003/004/005)", () => {
  itDb("a demoted admin's existing session can no longer reach admin endpoints", async () => {
    const b = await createUser("admin-b", "ADMIN");
    currentToken = await signInAs(b.id);
    expect((await listUsersAsCookieHolder()).status).toBe(200);

    expect((await adminPatch(b.id, { role: "USER" })).status).toBe(200);

    // Demotion signs the user out (spec 045, US1 scenario 1), same as suspension and deletion.
    expect((await resolveSession(currentToken)).session).toBeNull();
    expect((await listUsersAsCookieHolder()).status).toBe(401);
  });

  itDb("a demoted admin who signs in again is a plain USER and gets 403", async () => {
    const b = await createUser("admin-b", "ADMIN");
    await adminPatch(b.id, { role: "USER" });

    currentToken = await signInAs(b.id);

    expect((await resolveSession(currentToken)).session?.user.role).toBe("USER");
    expect((await listUsersAsCookieHolder()).status).toBe(403);
  });

  itDb("re-promoting does not revive the old session (FR-005)", async () => {
    const b = await createUser("admin-b", "ADMIN");
    currentToken = await signInAs(b.id);
    await adminPatch(b.id, { role: "USER" });
    await adminPatch(b.id, { role: "ADMIN" });

    expect((await listUsersAsCookieHolder()).status).toBe(401);
  });

  itDb("a promoted user gets admin rights without signing in again", async () => {
    const u = await createUser("user-u", "USER");
    currentToken = await signInAs(u.id);
    expect((await listUsersAsCookieHolder()).status).toBe(403);

    await adminPatch(u.id, { role: "ADMIN" });

    expect((await listUsersAsCookieHolder()).status).toBe(200);
  });
});

describe("suspension and deletion (US2, FR-002/005)", () => {
  itDb("a suspended user's session resolves to null", async () => {
    const u = await createUser("user-u");
    currentToken = await signInAs(u.id);
    expect((await resolveSession(currentToken)).session).not.toBeNull();

    await adminPatch(u.id, { status: "SUSPENDED" });

    expect((await resolveSession(currentToken)).session).toBeNull();
  });

  itDb("reactivating does not revive the old session, but a new sign-in works", async () => {
    const u = await createUser("user-u");
    currentToken = await signInAs(u.id);
    await adminPatch(u.id, { status: "SUSPENDED" });
    await adminPatch(u.id, { status: "ACTIVE" });

    expect((await resolveSession(currentToken)).session).toBeNull();
    const fresh = await signInAs(u.id);
    expect((await resolveSession(fresh)).session).not.toBeNull();
  });

  itDb("a deleted user's session resolves to null (never an empty identity)", async () => {
    const u = await createUser("user-u");
    currentToken = await signInAs(u.id);

    expect((await adminDelete(u.id)).status).toBe(200);

    const { session } = await resolveSession(currentToken);
    expect(session).toBeNull();
  });
});

describe("password change (US3, FR-007/008)", () => {
  itDb("an admin-set password ends the user's sessions even if they refresh constantly", async () => {
    const u = await createUser("user-u");
    currentToken = await signInAs(u.id);
    currentToken = (await resolveSession(currentToken, "update", { activity: true })).next;

    await adminPatch(u.id, { changePassword: true, password: "newpassword123" });

    const refreshed = await resolveSession(currentToken, "update", { activity: true });
    expect(refreshed.session).toBeNull();
    const fresh = await signInAs(u.id);
    expect((await resolveSession(fresh)).session).not.toBeNull();
  });

  itDb("an email-only change keeps the session (Clarifications Q4)", async () => {
    const u = await createUser("user-u");
    currentToken = await signInAs(u.id);

    await adminPatch(u.id, { email: `renamed${EMAIL_SUFFIX}` });

    expect((await resolveSession(currentToken)).session).not.toBeNull();
  });
});

describe("idle timeout (US4, FR-009/010/011)", () => {
  itDb("ends an idle session, but activity keeps it alive", async () => {
    const u = await createUser("user-u");
    await db.authSettings.update({ where: { id: "singleton" }, data: { sessionTimeoutMinutes: 60 } });
    const signedIn = await signInAs(u.id);

    const hourAndAMinute = 61 * 60_000;
    const idle = { ...signedIn, lastActivityAt: Date.now() - hourAndAMinute };
    expect((await resolveSession(idle)).session).toBeNull();

    const before = Date.now() - 59 * 60_000;
    const active = { ...signedIn, lastActivityAt: before };
    const kept = await resolveSession(active, "update", { activity: true });
    expect(kept.session).not.toBeNull();
    expect(kept.next?.lastActivityAt as number).toBeGreaterThan(before);
  });

  itDb("a long-lived session is not ended when no timeout is configured", async () => {
    const u = await createUser("user-u");
    const signedIn = await signInAs(u.id);
    const ancient = { ...signedIn, lastActivityAt: Date.now() - 80 * 24 * 60 * 60_000 };

    expect((await resolveSession(ancient)).session).not.toBeNull();
  });
});
