import { createBrowserClient } from '@supabase/ssr'
import { assertSupabaseEnv } from './env'

export function createClient() {
    const { url, anonKey } = assertSupabaseEnv()

    return createBrowserClient(
        url,
        anonKey
    )
}
