# Auth --- Logout Flow (SSR Session Model)

## Purpose

Define the canonical logout mechanism for SmartSeller v2 under the SSR
cookie-based session model defined in ADR-0003.

Logout must invalidate the Supabase session and remove authentication
cookies deterministically.

------------------------------------------------------------------------

## Architectural Context

SmartSeller v2 uses:

-   Supabase authentication
-   Google OAuth for human login
-   Cookie-based SSR session model
-   `/api/me` as canonical identity resolution endpoint

The session is stored in httpOnly cookies.

Therefore:

-   Logout must be executed server-side.
-   Client-only token clearing is forbidden.
-   JWT parsing on frontend is forbidden.
-   Session invalidation must propagate via cookie mutation.

------------------------------------------------------------------------

## Endpoint

### `POST /api/auth/logout`

Location (v2 structure):

    src/app/(v2)/api/auth/logout/route.ts

------------------------------------------------------------------------

## Flow

1.  User clicks "Logout".

2.  Frontend calls:

        POST /api/auth/logout

3.  Server:

    -   Instantiates Supabase SSR client.
    -   Executes `supabase.auth.signOut()`.
    -   Clears auth cookies via `setAll`.
    -   Redirects to `/enter`.

4.  Browser receives updated cookies.

5.  Subsequent `GET /api/me` returns:

        401 Unauthorized

------------------------------------------------------------------------

## Implementation Requirements

### Supabase SSR Client

Must use:

-   `createServerClient`
-   `cookies.getAll`
-   `cookies.setAll`

Cookies must be written on the `NextResponse` that is returned.

Failure to attach cookies to the returned response will cause session
persistence bugs.

------------------------------------------------------------------------

## Invariants

-   Logout must invalidate session cookies.
-   Logout must not rely on client-side state clearing.
-   `/api/me` must return 401 after logout.
-   No session data may remain accessible after logout.
-   Navigation must not rely on stale client memory.

------------------------------------------------------------------------

## Failure Modes

### 1. Logout endpoint returns 200 but session persists

Cause: - Cookies not written to response. - Response object mismatch.

### 2. `/api/me` still returns user after logout

Cause: - Supabase session not invalidated. - Browser retained cookies
due to incorrect domain/sameSite/secure settings.

### 3. Infinite redirect loop after logout

Cause: - `/enter` auto-redirect logic incorrectly detects stale session.

------------------------------------------------------------------------

## Verification Checklist

After implementing logout:

1.  Login with Google.

2.  Confirm `/api/me` returns 200.

3.  Click Logout.

4.  Confirm redirect to `/enter`.

5.  Call `/api/me`.

6.  Confirm response is:

        401 Unauthorized

------------------------------------------------------------------------

## Security Properties

-   Cookies must be:
    -   httpOnly
    -   secure (production)
    -   sameSite appropriately configured
-   Logout must not expose session tokens.
-   Service role keys must never be used for logout.

------------------------------------------------------------------------

## Relationship with Mercado Libre OAuth

Logout only invalidates human session.

It does NOT:

-   Revoke Mercado Libre access_token
-   Remove store linkage
-   Delete refresh_token

Those actions belong to: - Channel disconnect flow (future spec)

------------------------------------------------------------------------

## ADR Reference

Complies with:

`docs/adr/ADR-0003-session-model.md`

Session model: SSR cookie-based, server authoritative.