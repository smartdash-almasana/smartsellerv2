import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function sanitizeNext(raw: string | null): string | null {
    if (!raw) return null;
    if (!raw.startsWith("/")) return null;
    if (raw.startsWith("//")) return null;
    return raw;
}

export async function GET(req: NextRequest) {
    const cookieStore = await cookies();

    const response = NextResponse.redirect(
        new URL(
            sanitizeNext(req.nextUrl.searchParams.get("next")) ?? "/post-login",
            req.url
        )
    );

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll: (cookiesToSet) => {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    await supabase.auth.exchangeCodeForSession(req.url);

    return response;
}