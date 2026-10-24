/**
 * Pure decision logic for session validity (spec 045, ADR 0006).
 * Decides from app-owned claims and the authoritative user record, never from `iat`/`exp`.
 */

import type { User } from "@prisma/client";

/** A point in time as epoch milliseconds. Do not mix with the epoch seconds used by `iat`/`exp`. */
export type EpochMs = number;

/** Why a session was judged invalid. */
export type SessionInvalidReason =
  | "USER_NOT_FOUND"
  | "USER_INACTIVE"
  | "PASSWORD_CHANGED"
  | "SESSIONS_REVOKED"
  | "IDLE_TIMEOUT";

/**
 * Outcome of {@link evaluateSession}. A valid result carries the (non-null) user it was judged against.
 *
 * @typeParam U - The user record type that was evaluated.
 */
export type SessionEvaluation<U extends SessionUserState = SessionUserState> =
  | { readonly valid: true; readonly user: U }
  | { readonly valid: false; readonly reason: SessionInvalidReason };

/** The app-owned time claims carried by the session token. */
export interface SessionTimeClaims {
  /** When the session was originally signed in. Never changes during the session's life. */
  readonly authTime: EpochMs;
  /** When the user last interacted with the application. Never earlier than `authTime`. */
  readonly lastActivityAt: EpochMs;
}

/** The subset of the `User` record the decision depends on. */
export type SessionUserState = Readonly<Pick<User, "status" | "passwordChangedAt" | "sessionsRevokedAt">>;

/** Inputs for {@link evaluateSession}. */
export interface EvaluateSessionParams<U extends SessionUserState = SessionUserState> {
  readonly token: SessionTimeClaims;
  /** The user record, or `null` when the user no longer exists. */
  readonly user: U | null;
  /** Configured idle timeout in minutes (positive), or `null` for no idle timeout. */
  readonly timeoutMinutes: number | null;
  /** Current time. */
  readonly now: EpochMs;
}

const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1000;

/**
 * Decides whether a session is still valid.
 *
 * Comparisons use a strict `<` so a sign-in in the same millisecond as a password change
 * or revocation is not rejected.
 *
 * @typeParam U - The user record type; a valid result hands the same record back, narrowed to non-null.
 * @param params - Token time claims, the current user record, the idle timeout, and the clock.
 * @returns `{ valid: true, user }`, or `{ valid: false, reason }` naming the first failed rule.
 */
export function evaluateSession<U extends SessionUserState>(params: EvaluateSessionParams<U>): SessionEvaluation<U> {
  const { token, user, timeoutMinutes, now } = params;

  if (user === null) { return { valid: false, reason: "USER_NOT_FOUND" }; }
  if (user.status !== "ACTIVE") { return { valid: false, reason: "USER_INACTIVE" }; }

  if (user.passwordChangedAt && token.authTime < user.passwordChangedAt.getTime()) {
    return { valid: false, reason: "PASSWORD_CHANGED" };
  }
  if (user.sessionsRevokedAt && token.authTime < user.sessionsRevokedAt.getTime()) {
    return { valid: false, reason: "SESSIONS_REVOKED" };
  }

  if (timeoutMinutes !== null && now - token.lastActivityAt > timeoutMinutes * MS_PER_MINUTE) {
    return { valid: false, reason: "IDLE_TIMEOUT" };
  }

  return { valid: true, user };
}

/** Token fields {@link resolveTimeClaims} reads. `iat` is epoch seconds, as written by Auth.js. */
export interface TimeClaimSource {
  readonly authTime?: EpochMs;
  readonly lastActivityAt?: EpochMs;
  readonly iat?: number;
}

/**
 * Determines the time claims for the current jwt callback call.
 *
 * - Sign-in: both claims are `now`.
 * - Existing claims are kept as they are.
 * - Tokens issued before spec 045 have no `authTime`. They fall back to their `iat` (Auth.js's last
 *   re-encode time, so never later than the cookie's last use), which keeps a dormant cookie from
 *   outliving a password change made before the deployment, and to `now` when there is no `iat`.
 *   A missing `lastActivityAt` becomes `now`, so nobody is signed out by the deployment itself.
 *
 * @param source - The incoming token fields.
 * @param isSignIn - Whether this call is a fresh sign-in.
 * @param now - Current time.
 * @returns The claims to carry on the token.
 */
export function resolveTimeClaims(source: TimeClaimSource, isSignIn: boolean, now: EpochMs): SessionTimeClaims {
  if (isSignIn) { return { authTime: now, lastActivityAt: now }; }

  const legacyAuthTime = typeof source.iat === "number" ? source.iat * MS_PER_SECOND : now;
  return {
    authTime: source.authTime ?? legacyAuthTime,
    lastActivityAt: source.lastActivityAt ?? now,
  };
}

/** The payload the client sends with `update()` to report real user input. */
export interface SessionActivityUpdate {
  readonly activity: true;
}

/**
 * Narrows an untyped `update()` payload to {@link SessionActivityUpdate}.
 * Only the exact boolean `true` counts, so truthy strings cannot extend a session.
 *
 * @param value - The `session` argument of the jwt callback.
 * @returns `true` when the payload reports user activity.
 */
export function isSessionActivityUpdate(value: unknown): value is SessionActivityUpdate {
  return typeof value === "object" && value !== null && (value as { activity?: unknown }).activity === true;
}
