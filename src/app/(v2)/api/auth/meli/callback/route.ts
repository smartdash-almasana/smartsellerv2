import { NextRequest, NextResponse } from 'next/server';
import { consumeOAuthState, exchangeToken, getMeliUser } from '@v2/lib/meli/oauth';
import { upsertStoreAndMembership } from '@v2/lib/stores/linkStore';
import { persistInstallationTokens } from '@v2/lib/meli/installations';

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
        const { codeVerifier, userId } = await consumeOAuthState(state);
        const tokens = await exchangeToken(code, codeVerifier);
        const meliUser = await getMeliUser(tokens.access_token);

        const { storeId } = await upsertStoreAndMembership({
            userId,
            providerKey: 'mercadolibre',
            externalAccountId: meliUser.id,
            displayName: meliUser.nickname ? `ML ${meliUser.nickname}` : `ML ${meliUser.id}`,
        });

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
