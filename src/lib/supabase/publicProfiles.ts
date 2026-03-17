import { assertSupabaseEnv } from './env'

type PublicProfile = {
    id: string
    display_name: string | null
    avatar_url: string | null
}

export async function fetchPublicProfiles() {
    const { url, anonKey } = assertSupabaseEnv()
    const response = await fetch(
        `${url}/rest/v1/profiles?select=id,display_name,avatar_url`,
        {
            headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
            },
            cache: 'no-store',
        }
    )

    if (!response.ok) {
        throw new Error(`Public profiles fetch failed: ${response.status}`)
    }

    const profiles = await response.json() as PublicProfile[]
    const profileMap: Record<string, { display_name: string, avatar_url: string }> = {}

    profiles.forEach((profile) => {
        profileMap[profile.id] = {
            display_name: profile.display_name || '冒険者',
            avatar_url: profile.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(profile.display_name || profile.id)}`
        }
    })

    return profileMap
}
