import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const tokenHash = requestUrl.searchParams.get('token_hash')
    const type = requestUrl.searchParams.get('type')
    const next = requestUrl.searchParams.get('next') || '/update-password'

    let response = NextResponse.redirect(new URL(next, requestUrl.origin))

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    if (code) {
        await supabase.auth.exchangeCodeForSession(code)
        return response
    }

    if (tokenHash && type) {
        const emailOtpTypes = ['signup', 'recovery', 'invite', 'magiclink', 'email_change'] as const
        if (!emailOtpTypes.includes(type as (typeof emailOtpTypes)[number])) {
            return NextResponse.redirect(new URL('/login?error=invalid_recovery_link', requestUrl.origin))
        }

        await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as (typeof emailOtpTypes)[number],
        })
        return response
    }

    return NextResponse.redirect(new URL('/login?error=invalid_recovery_link', requestUrl.origin))
}
