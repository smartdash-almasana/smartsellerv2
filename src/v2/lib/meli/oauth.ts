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

interface OAuthStateRow {
    state: string;
    code_verifier: string;
    user_id: string | null;
    expires_at: string;
    used_at: string | null;
}

function getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`[meli/oauth] Missing env: ${name}`);
    return value;
}

export async function consumeOAuthState(state: string): Promise<{ codeVerifier: string; userId: string }> {
    const { data, error } = await supabaseAdmin
        .from('v2_oauth_states')
        .select('state, code_verifier, user_id, expires_at, used_at')
        .eq('state', state)
        .limit(1)
        .maybeSingle<OAuthStateRow>();

    if (error) throw new Error(`[meli/oauth] State lookup failed: ${error.message}`);
    if (!data) throw new Error('[meli/oauth] Invalid state');
    if (data.used_at) throw new Error('[meli/oauth] State already used');
    if (!data.user_id) throw new Error('[meli/oauth] State is not bound to an authenticated user');
    if (new Date(data.expires_at).getTime() < Date.now()) throw new Error('[meli/oauth] State expired');

    const { error: useError } = await supabaseAdmin
        .from('v2_oauth_states')
        .update({ used_at: new Date().toISOString() })
        .eq('state', state)
        .is('used_at', null);

    if (useError) throw new Error(`[meli/oauth] Failed to consume state: ${useError.message}`);
    return { codeVerifier: data.code_verifier, userId: data.user_id };
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
