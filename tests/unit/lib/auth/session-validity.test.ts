/**
 * Unit tests for evaluateSession in src/lib/auth/session-validity.ts.
 * Covers the decision table in specs/045-session-revocation-fix/data-model.md §3.
 */

import {
  evaluateSession,
  isSessionActivityUpdate,
  resolveTimeClaims,
} from "@/lib/auth/session-validity";

const NOW = 1_700_000_000_000;
const MINUTE = 60_000;

const ACTIVE_USER = {
  status: "ACTIVE" as const,
  passwordChangedAt: null,
  sessionsRevokedAt: null,
};

function evaluate(
  overrides: {
    token?: { authTime: number; lastActivityAt: number };
    user?: Parameters<typeof evaluateSession>[0]["user"];
    timeoutMinutes?: number | null;
  } = {},
) {
  return evaluateSession({
    token: overrides.token ?? { authTime: NOW - MINUTE, lastActivityAt: NOW - MINUTE },
    user: "user" in overrides ? overrides.user : ACTIVE_USER,
    timeoutMinutes: "timeoutMinutes" in overrides ? (overrides.timeoutMinutes ?? null) : null,
    now: NOW,
  });
}

describe("evaluateSession — user state", () => {
  it("is valid for an active user with no revocation markers", () => {
    expect(evaluate()).toMatchObject({ valid: true });
  });

  it("is invalid when the user no longer exists", () => {
    expect(evaluate({ user: null })).toEqual({ valid: false, reason: "USER_NOT_FOUND" });
  });

  it.each(["PENDING", "SUSPENDED"] as const)("is invalid when status is %s", (status) => {
    expect(evaluate({ user: { ...ACTIVE_USER, status } })).toEqual({
      valid: false,
      reason: "USER_INACTIVE",
    });
  });
});

describe("evaluateSession — password change (FR-007, FR-008)", () => {
  it("is invalid when authTime is before passwordChangedAt", () => {
    const user = { ...ACTIVE_USER, passwordChangedAt: new Date(NOW - 30_000) };
    const token = { authTime: NOW - 40_000, lastActivityAt: NOW };
    expect(evaluate({ user, token })).toEqual({ valid: false, reason: "PASSWORD_CHANGED" });
  });

  it("is valid when authTime equals passwordChangedAt (same-millisecond sign-in)", () => {
    const user = { ...ACTIVE_USER, passwordChangedAt: new Date(NOW - 30_000) };
    const token = { authTime: NOW - 30_000, lastActivityAt: NOW };
    expect(evaluate({ user, token })).toMatchObject({ valid: true });
  });

  it("is valid when the session was created after the password change", () => {
    const user = { ...ACTIVE_USER, passwordChangedAt: new Date(NOW - 30_000) };
    const token = { authTime: NOW - 10_000, lastActivityAt: NOW };
    expect(evaluate({ user, token })).toMatchObject({ valid: true });
  });
});

describe("evaluateSession — admin revocation (FR-004, FR-005)", () => {
  it("is invalid when authTime is before sessionsRevokedAt", () => {
    const user = { ...ACTIVE_USER, sessionsRevokedAt: new Date(NOW - 30_000) };
    const token = { authTime: NOW - 40_000, lastActivityAt: NOW };
    expect(evaluate({ user, token })).toEqual({ valid: false, reason: "SESSIONS_REVOKED" });
  });

  it("is valid when authTime equals sessionsRevokedAt", () => {
    const user = { ...ACTIVE_USER, sessionsRevokedAt: new Date(NOW - 30_000) };
    const token = { authTime: NOW - 30_000, lastActivityAt: NOW };
    expect(evaluate({ user, token })).toMatchObject({ valid: true });
  });

  it("keeps an old session invalid after the user is reactivated", () => {
    // Reactivation sets status back to ACTIVE but never clears sessionsRevokedAt.
    const user = { ...ACTIVE_USER, sessionsRevokedAt: new Date(NOW - 5 * MINUTE) };
    const token = { authTime: NOW - 60 * MINUTE, lastActivityAt: NOW };
    expect(evaluate({ user, token })).toEqual({ valid: false, reason: "SESSIONS_REVOKED" });
  });

  it("allows a session created after the revocation", () => {
    const user = { ...ACTIVE_USER, sessionsRevokedAt: new Date(NOW - 5 * MINUTE) };
    const token = { authTime: NOW - MINUTE, lastActivityAt: NOW };
    expect(evaluate({ user, token })).toMatchObject({ valid: true });
  });
});

describe("evaluateSession — idle timeout (FR-009, FR-010, FR-011)", () => {
  it("never expires from inactivity when the timeout is null", () => {
    const token = { authTime: NOW - 400 * 24 * 60 * MINUTE, lastActivityAt: NOW - 400 * 24 * 60 * MINUTE };
    expect(evaluate({ token, timeoutMinutes: null })).toMatchObject({ valid: true });
  });

  it("is valid exactly at the timeout boundary", () => {
    const token = { authTime: NOW - 120 * MINUTE, lastActivityAt: NOW - 60 * MINUTE };
    expect(evaluate({ token, timeoutMinutes: 60 })).toMatchObject({ valid: true });
  });

  it("is invalid one millisecond past the timeout", () => {
    const token = { authTime: NOW - 120 * MINUTE, lastActivityAt: NOW - 60 * MINUTE - 1 };
    expect(evaluate({ token, timeoutMinutes: 60 })).toEqual({ valid: false, reason: "IDLE_TIMEOUT" });
  });

  it("does not count time since sign-in, only time since last activity", () => {
    const token = { authTime: NOW - 72 * 60 * MINUTE, lastActivityAt: NOW - MINUTE };
    expect(evaluate({ token, timeoutMinutes: 60 })).toMatchObject({ valid: true });
  });

  it("applies a shortened timeout to an existing session", () => {
    const token = { authTime: NOW - 180 * MINUTE, lastActivityAt: NOW - 120 * MINUTE };
    expect(evaluate({ token, timeoutMinutes: 1440 })).toMatchObject({ valid: true });
    expect(evaluate({ token, timeoutMinutes: 60 })).toEqual({ valid: false, reason: "IDLE_TIMEOUT" });
  });
});

describe("evaluateSession — precedence", () => {
  it("reports a missing user before any other reason", () => {
    const token = { authTime: 0, lastActivityAt: 0 };
    expect(evaluate({ user: null, token, timeoutMinutes: 60 })).toEqual({
      valid: false,
      reason: "USER_NOT_FOUND",
    });
  });
});

describe("evaluateSession — valid result", () => {
  it("hands back the evaluated user so callers need no second null check", () => {
    const user = { ...ACTIVE_USER, extra: "kept" };
    const result = evaluateSession({
      token: { authTime: NOW - MINUTE, lastActivityAt: NOW - MINUTE },
      user,
      timeoutMinutes: null,
      now: NOW,
    });
    expect(result).toEqual({ valid: true, user });
  });
});

describe("resolveTimeClaims", () => {
  it("sets both claims to now on sign-in, ignoring anything already on the token", () => {
    expect(resolveTimeClaims({ authTime: 1, lastActivityAt: 2, iat: 3 }, true, NOW)).toEqual({
      authTime: NOW,
      lastActivityAt: NOW,
    });
  });

  it("keeps existing claims", () => {
    expect(resolveTimeClaims({ authTime: NOW - 5 * MINUTE, lastActivityAt: NOW - MINUTE, iat: 1 }, false, NOW)).toEqual({
      authTime: NOW - 5 * MINUTE,
      lastActivityAt: NOW - MINUTE,
    });
  });

  it("falls back to iat (seconds → ms) for a legacy token's authTime", () => {
    const iat = Math.floor((NOW - 10 * MINUTE) / 1000);
    expect(resolveTimeClaims({ iat }, false, NOW)).toEqual({ authTime: iat * 1000, lastActivityAt: NOW });
  });

  it("falls back to now when a legacy token has no iat", () => {
    expect(resolveTimeClaims({}, false, NOW)).toEqual({ authTime: NOW, lastActivityAt: NOW });
  });

  it("keeps a present authTime even when lastActivityAt is missing", () => {
    expect(resolveTimeClaims({ authTime: NOW - MINUTE }, false, NOW)).toEqual({
      authTime: NOW - MINUTE,
      lastActivityAt: NOW,
    });
  });
});

describe("isSessionActivityUpdate", () => {
  it("accepts only the exact boolean true", () => {
    expect(isSessionActivityUpdate({ activity: true })).toBe(true);
    expect(isSessionActivityUpdate({ activity: true, other: 1 })).toBe(true);
  });

  it.each([undefined, null, "activity", 1, {}, { activity: false }, { activity: "true" }, { activity: 1 }])(
    "rejects %p",
    (value) => {
      expect(isSessionActivityUpdate(value)).toBe(false);
    },
  );
});
