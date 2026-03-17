const REQUIRED_SUPABASE_ENV_VARS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

type RequiredSupabaseEnvVar = (typeof REQUIRED_SUPABASE_ENV_VARS)[number]

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function getMissingSupabaseEnvVars() {
    const missing: RequiredSupabaseEnvVar[] = []
    if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
    if (!SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return missing
}

export function assertSupabaseEnv() {
    const missing = getMissingSupabaseEnvVars()
    if (missing.length > 0) {
        throw new Error(`Missing Supabase environment variables: ${missing.join(', ')}`)
    }

    return {
        url: SUPABASE_URL!,
        anonKey: SUPABASE_ANON_KEY!,
    }
}
