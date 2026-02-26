import { supabaseAdmin } from '@v2/lib/supabase';

interface PersistInstallationTokensInput {
    storeId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    raw?: unknown;
}

export async function persistInstallationTokens(input: PersistInstallationTokensInput): Promise<void> {
    const { error } = await supabaseAdmin
        .from('v2_oauth_tokens')
        .upsert(
            {
                store_id: input.storeId,
                access_token: input.accessToken,
                refresh_token: input.refreshToken,
                expires_at: input.expiresAt,
                status: 'active',
                updated_at: new Date().toISOString(),
                raw: input.raw ?? null,
            },
            { onConflict: 'store_id' }
        );

    if (error) {
        throw new Error(`[meli/installations] token persist failed: ${error.message}`);
    }
}
