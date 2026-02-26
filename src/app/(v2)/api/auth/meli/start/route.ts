// ============================================================================
// SmartSeller V2 — /api/auth/meli/start
// GET: initiates PKCE OAuth flow for MercadoLibre
//
// 1. Generate cryptographically random state + code_verifier
// 2. Derive code_challenge (S256)
// 3. Persist to v2_oauth_states (TTL = 10 min)
// 4. Redirect to ML authorization URL
//
// Env vars required: MELI_APP_ID, MELI_REDIRECT_URI
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@v2/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// ─── PKCE helpers ─────────────────────────────────────────────────────────────
function generateRandomBase64url(byteLength: number): string {
    const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
    return Buffer.from(bytes).toString('base64url');
}

async function deriveCodeChallenge(verifier: string): Promise<string> {
    const encoded = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Buffer.from(digest).toString('base64url');
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const appId = process.env.MELI_APP_ID;
    const redirectUri = process.env.MELI_REDIRECT_URI;

    if (!appId || !redirectUri) {
        return NextResponse.json(
            { error: 'Missing env: MELI_APP_ID or MELI_REDIRECT_URI' },
            { status: 500 }
        );
    }

    // Optionally bind state to authenticated Supabase user
    const cookieStore = await cookies();
    const supabaseUser = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: () => { },  // read-only here
            },
        }
    );
    const { data: { session } } = await supabaseUser.auth.getSession();
    const userId = session?.user?.id ?? null;

    // Generate PKCE pair
    const state = generateRandomBase64url(32);          // 256-bit state
    const codeVerifier = generateRandomBase64url(48);    // 384-bit verifier
    const codeChallenge = await deriveCodeChallenge(codeVerifier);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min TTL

    // Persist PKCE state
    const { error: insertErr } = await supabaseAdmin
        .from('v2_oauth_states')
        .insert({
            state,
            code_verifier: codeVerifier,
            user_id: userId,
            expires_at: expiresAt,
        });

    if (insertErr) {
        console.error('[auth/meli/start] Failed to persist state:', insertErr.message);
        return NextResponse.json({ error: 'Failed to initiate OAuth' }, { status: 500 });
    }

    // Build ML authorization URL
    const authUrl = new URL('https://auth.mercadolibre.com.ar/authorization');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return NextResponse.redirect(authUrl.toString());
}
