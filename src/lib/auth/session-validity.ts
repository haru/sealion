/**
 * Pure decision function for session validity (spec 045, ADR 0006).
 * Decides from app-owned claims and the authoritative user record, never from `iat`/`exp`.
 */

/** Why a session was judged invalid. */
export type SessionInvalidReason =
  | "USER_NOT_FOUND"
  | "USER_INACTIVE"
  | "PASSWORD_CHANGED"
  | "SESSIONS_REVOKED"
  | "IDLE_TIMEOUT";

/** Outcome of {@link evaluateSession}. */
export type SessionEvaluation =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: SessionInvalidReason };

/** The app-owned time claims carried by the session token (epoch milliseconds). */
export interface SessionTimeClaims {
  /** When the session was originally signed in. Never changes during the session's life. */
  readonly authTime: number;
  /** When the user last interacted with the application. */
  readonly lastActivityAt: number;
}

/** The subset of the `User` record the decision depends on. */
export interface SessionUserState {
  readonly status: "PENDING" | "ACTIVE" | "SUSPENDED";
  readonly passwordChangedAt: Date | null;
  readonly sessionsRevokedAt: Date | null;
}

/** Inputs for {@link evaluateSession}. */
export interface EvaluateSessionParams {
  readonly token: SessionTimeClaims;
  /** The user record, or `null` when the user no longer exists. */
  readonly user: SessionUserState | null;
  /** Configured idle timeout in minutes, or `null` for no idle timeout. */
  readonly timeoutMinutes: number | null;
  /** Current time in epoch milliseconds. */
  readonly now: number;
}

const MS_PER_MINUTE = 60_000;

/**
 * Decides whether a session is still valid.
 *
 * Comparisons use a strict `<` so a sign-in in the same millisecond as a password change
 * or revocation is not rejected.
 *
 * @param params - Token time claims, the current user record, the idle timeout, and the clock.
 * @returns `{ valid: true }`, or `{ valid: false, reason }` naming the first failed rule.
 */
export function evaluateSession(params: EvaluateSessionParams): SessionEvaluation {
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

  return { valid: true };
}
