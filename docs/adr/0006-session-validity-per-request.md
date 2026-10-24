# ADR 0006: Validate session validity on every request with app-owned claims

## Context

Sealion uses Auth.js v5 with the stateless JWT session strategy (`maxAge` 90 days, rolling). A security review (spec `045-session-revocation-fix`, findings F1 and F2) found three related defects.

- **Revocation did not work (F1).** `role` was copied into the JWT at sign-in and never refreshed. `status` and user existence were never re-checked. A demoted, suspended, or deleted administrator therefore kept full admin access for as long as the cookie lived, and the cookie is extended on every use. Admin route handlers trust `session.user.role`.
- **Session timeout and password-change invalidation were unreliable (F2).** Auth.js `encode()` (`@auth/core` 0.41.x) always calls `setIssuedAt()` and `setExpirationTime(now + maxAge)`. This overwrites any `iat` or `exp` written by the `jwt` callback.
  - The admin "Session Timeout" setting therefore had no effect.
  - The password-change check (`token.iat < passwordChangedAt`) could be bypassed. `iat` moves forward every time the cookie is re-encoded, and the DB re-check was cached for 5 minutes.
- **Revoked sessions looked authenticated.** Revoked sessions were returned as `{}`. Auth.js treats `{}` as a valid token, so it produced a "session" with an empty user id that passed `if (!session)` guards.

Several approaches can make sessions revocable:

1. Switch Auth.js to the database session strategy.
2. Keep JWT sessions, but re-validate against the `User` row on every request.
3. Keep JWT sessions with short lifetimes and refresh tokens.

## Decision

We keep the JWT session strategy. Session validity is decided on **every request** inside the Auth.js `jwt` callback, using the authoritative `User` row and **application-owned claims**.

1. **Per-request lookup.** The `jwt` callback runs for server-side `auth()` and for client `/api/auth/session` calls. On every invocation it performs one primary-key lookup of the user (`role`, `status`, `passwordChangedAt`, `sessionsRevokedAt`, `useGravatar`). The previous 5-minute cache is removed. `role` is always taken from the DB, never trusted from the token.
2. **Revocation returns `null`.** The callback returns `null`, never `{}`, when any of the following holds:
   - the user no longer exists
   - `status !== ACTIVE`
   - `authTime < passwordChangedAt`
   - `authTime < sessionsRevokedAt`
   - the idle timeout has elapsed

   Auth.js then clears the cookie, and `auth()` returns `null`.
3. **App-owned time claims.** Security decisions never use `iat` or `exp`.
   - `authTime` (epoch ms) is set once at sign-in and never changes. It is compared with `passwordChangedAt` and `sessionsRevokedAt`.
   - `lastActivityAt` (epoch ms) is updated only by an explicit client `update({ activity: true })`, which is throttled to at most once per 60 s from real user input events. It is compared with `AuthSettings.sessionTimeoutMinutes`, which is now an **idle** timeout.
4. **Revocation timestamp.** A nullable `User.sessionsRevokedAt` column is set when an admin demotes a user (`ADMIN → USER`) or moves a user out of `ACTIVE`. Admin password changes set `passwordChangedAt`. Promotion and reactivation do not revoke. Because revocation is time-based, a revoked session cannot be revived by later re-promotion or reactivation.
5. **No server-side exceptions for the current session.** When users change their own password, the server revokes all sessions. The settings page then signs in again with the new password, so the current browser continues without a prompt. The server keeps no "keep this session" state that a client could spoof.
6. **Migration without mass sign-out.** Tokens issued before this change lack `authTime`. They are treated as signed in at first sight after deployment.

## Status

Proposed

## Consequences

**Positive**

- Demotion, suspension, deletion, and password changes take effect on the very next request, for both server-rendered pages and API routes.
- The admin session-timeout setting works and matches user expectations. Users who keep working are never logged out mid-task.
- All validity rules live in one place (`jwt` callback plus a pure `evaluateSession` function), so new routes are protected without per-route code.
- No change of session infrastructure, and no change to cookies or Auth.js configuration beyond callbacks.

**Negative**

- Every authenticated request performs one extra primary-key query (target: ≤ 10% median latency increase). DB unavailability now fails closed for authentication.
- We depend on the Auth.js behaviour that the `jwt` callback runs on every `auth()` and session fetch, and that returning `null` clears the session. An Auth.js upgrade must be checked against this ADR.
- Idle detection relies on a client component sending `update({ activity: true })`. A client can extend its own idle timer at will. This is acceptable, because the idle timeout protects against abandoned devices, not against an attacker who already holds the cookie (revocation and password changes cover that).
- Explicit sign-out still only clears the local cookie. A stolen cookie stays usable until revocation, a password change, or idle expiry. Per-session server-side revocation lists remain out of scope.

**Alternatives rejected**

- **Database session strategy:** gives true server-side revocation, but replaces the whole session infrastructure (and adapter and session table usage) for a problem that per-request validation solves. Revisit if per-session sign-out becomes a requirement.
- **Short-lived JWT plus refresh token:** more moving parts. It still needs a DB check at refresh time, and revocation would only be eventual.
- **Dynamic `session.maxAge` from settings:** cannot express an idle timeout and cannot apply setting changes to existing sessions.

## Date

2026-10-24
