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
import { persistInstallationTokens } from '@v2/lib/meli/installations';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

    if (!code || !state) {
        return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
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
                console.warn('[auth/meli/callback] Could not read session cookie:', sessionErr);
            }
        }

        if (!userId) {
            throw new Error('[auth/meli/callback] No authenticated user available — cannot link store');
        }

        // ── 3. Exchange authorization code → tokens ───────────────────────────
        const tokens = await exchangeToken(code, codeVerifier);

        // ── 4. Fetch Mercado Libre user ───────────────────────────────────────
        const meliUser = await getMeliUser(tokens.access_token);

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
        console.error('[auth/meli/callback]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
