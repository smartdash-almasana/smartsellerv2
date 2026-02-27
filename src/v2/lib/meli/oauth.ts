import { supabaseAdmin } from '@v2/lib/supabase';

const MELI_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const MELI_ME_URL = 'https://api.mercadolibre.com/users/me';

export interface ExchangedTokens {
    access_token: string;
    refresh_token: string;
    expires_at: string;
    raw: unknown;
}

export interface MeliUser {
    id: string;
    nickname: string | null;
}

interface ConsumeOAuthStateRow {
    code_verifier: string;
    user_id: string | null;
}

function getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`[meli/oauth] Missing env: ${name}`);
    return value;
}

/**
 * Atomically consumes an OAuth state (single-use, via DELETE...RETURNING).
 * Uses service-role (supabaseAdmin) — bypasses RLS.
 * Returns userId as null when /start was called without an active session.
 *
 * Race-condition safe: the DB function deletes the row atomically so no
 * second consumer can claim the same state.
 */
export async function consumeOAuthState(state: string): Promise<{ codeVerifier: string; userId: string | null }> {
    const { data, error } = await supabaseAdmin
        .rpc('consume_oauth_state', { p_state: state })
        .returns<ConsumeOAuthStateRow[]>();

    if (error) {
        console.error('[meli/oauth] consume_oauth_state RPC error:', error.message);
        throw new Error(`[meli/oauth] State consume failed: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : undefined;
    if (!row) {
        // State not found, expired, or already used (DELETE returned 0 rows)
        console.warn('[meli/oauth] consumeOAuthState: no row returned — state invalid, expired, or already used');
        throw new Error('[meli/oauth] Invalid state or session expired (db)');
    }

    console.log(
        '[meli/oauth] consumeOAuthState: state consumed OK; user_id =',
        row.user_id ?? 'null (no session at /start)',
    );
    return { codeVerifier: row.code_verifier, userId: row.user_id ?? null };
}

export async function exchangeToken(code: string, codeVerifier: string): Promise<ExchangedTokens> {
    const res = await fetch(MELI_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: getRequiredEnv('MELI_APP_ID'),
            client_secret: getRequiredEnv('MELI_CLIENT_SECRET'),
            code,
            redirect_uri: getRequiredEnv('MELI_REDIRECT_URI'),
            code_verifier: codeVerifier,
        }),
        cache: 'no-store',
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`[meli/oauth] Token exchange failed (${res.status})`);
    if (!body.access_token || !body.refresh_token || !body.expires_in) {
        throw new Error('[meli/oauth] Token response missing required fields');
    }

    return {
        access_token: String(body.access_token),
        refresh_token: String(body.refresh_token),
        expires_at: new Date(Date.now() + Number(body.expires_in) * 1000).toISOString(),
        raw: body,
    };
}

export async function getMeliUser(accessToken: string): Promise<MeliUser> {
    const res = await fetch(MELI_ME_URL, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        cache: 'no-store',
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`[meli/oauth] users/me failed (${res.status})`);
    if (body.id === undefined || body.id === null) throw new Error('[meli/oauth] users/me missing id');

    return {
        id: String(body.id),
        nickname: body.nickname ? String(body.nickname) : null,
    };
}
