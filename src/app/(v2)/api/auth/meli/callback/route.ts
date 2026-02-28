// ============================================================================
// SmartSeller V2 — /api/auth/meli/callback
// GET: receives code + state from Mercado Libre after user authorization
//
// Flow:
//   1. Consume state atomically (DELETE...RETURNING via service-role RPC)
//   2. If state had no user_id, resolve from Supabase session cookie
//   3. Exchange code → tokens
//   4. Fetch ML user info
//   5. Upsert store + membership
//   6. Persist tokens
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { consumeOAuthState, exchangeToken, getMeliUser } from '@v2/lib/meli/oauth';
import { upsertStoreAndMembership } from '@v2/lib/stores/linkStore';
import { persistInstallationTokens, createPendingInstallation } from '@v2/lib/meli/installations';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function oauthErrorResponse(request: NextRequest, message: string, details?: Record<string, unknown>) {
    const retryHref = '/api/auth/meli/start';
    const accept = request.headers.get('accept') ?? '';
    if (accept.includes('text/html')) {
        const html = `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;line-height:1.4">
    <h1 style="margin:0 0 12px">Error en conexión Mercado Libre</h1>
    <p style="margin:0 0 16px">${message}</p>
    <p style="margin:0 0 20px"><a href="${retryHref}">Reintentar conexión</a></p>
  </body>
</html>`;
        return new NextResponse(html, {
            status: 400,
            headers: { 'content-type': 'text/html; charset=utf-8' },
        });
    }

    return NextResponse.json({ error: message, retry_url: retryHref, ...(details ?? {}) }, { status: 400 });
}

function appBaseUrl(request: NextRequest): string {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') ?? 'http';
    if (host) return `${proto}://${host}`;
    return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const correlationId = state ?? 'missing_state';

    // ── Surface ML provider errors (e.g. user denied, app misconfigured) ─────
    const mlError = url.searchParams.get('error');
    const mlErrorDescription = url.searchParams.get('error_description');
    if (mlError) {
        console.error('[auth/meli/callback]', correlationId, 'ML returned error:', mlError, mlErrorDescription);
        return oauthErrorResponse(request, String(mlError), {
            error_description: mlErrorDescription ?? null,
            hint: 'ML did not return code/state',
            correlation_id: correlationId,
        });
    }

    if (!code || !state) {
        return oauthErrorResponse(request, 'Missing code or state', { correlation_id: correlationId });
    }

    try {
        // ── 1. Atomic state consumption (DELETE...RETURNING, service-role) ────
        const { codeVerifier, userId: stateUserId } = await consumeOAuthState(state);

        // ── 2. Resolve userId — prefer state, fallback to session cookie ──────
        let userId: string | null = stateUserId;
        if (!userId) {
            try {
                const cookieStore = await cookies();
                const supabaseUser = createServerClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                    {
                        cookies: {
                            getAll: () => cookieStore.getAll(),
                            setAll: () => { },
                        },
                    },
                );
                const { data: { session } } = await supabaseUser.auth.getSession();
                userId = session?.user?.id ?? null;
                console.log(
                    '[auth/meli/callback] user_id resolved from session cookie:',
                    userId ?? 'null',
                );
            } catch (sessionErr) {
                console.warn('[auth/meli/callback]', correlationId, 'Could not read session cookie:', sessionErr);
            }
        }

        // ── 3. Exchange authorization code → tokens ───────────────────────────
        const tokens = await exchangeToken(code, codeVerifier);

        // ── 4. Fetch Mercado Libre user ───────────────────────────────────────
        const meliUser = await getMeliUser(tokens.access_token);

        if (!userId) {
            console.log('[auth/meli/callback] No user in session. Creating pending installation.');
            const installationId = await createPendingInstallation({
                providerKey: 'mercadolibre',
                stateId: state,
                externalAccountId: meliUser.id,
                tokens,
            });

            // Redirect to completion flow (it will require login)
            return NextResponse.redirect(new URL(`/install/meli/complete?installation_id=${installationId}`, appBaseUrl(request)));
        }

        // ── 5. Upsert store + membership ──────────────────────────────────────
        const { storeId } = await upsertStoreAndMembership({
            userId,
            providerKey: 'mercadolibre',
            externalAccountId: meliUser.id,
            displayName: meliUser.nickname ? `ML ${meliUser.nickname}` : `ML ${meliUser.id}`,
        });

        // ── 6. Persist tokens ─────────────────────────────────────────────────
        await persistInstallationTokens({
            storeId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expires_at,
            raw: tokens.raw,
        });

        return NextResponse.redirect(new URL('/post-login', appBaseUrl(request)));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'OAuth callback failed';
        console.error('[auth/meli/callback]', correlationId, message);
        return oauthErrorResponse(request, message, { correlation_id: correlationId });
    }
}
