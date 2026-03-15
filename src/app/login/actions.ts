'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function mapAuthErrorToCode(message: string) {
    const normalized = message.toLowerCase()

    if (normalized.includes('invalid login credentials')) return 'invalid_credentials'
    if (normalized.includes('email not confirmed')) return 'email_not_confirmed'
    if (normalized.includes('too many requests')) return 'too_many_requests'
    if (normalized.includes('network') || normalized.includes('fetch')) return 'network'
    if (normalized.includes('password should be at least')) return 'weak_password'
    if (normalized.includes('user already registered')) return 'user_exists'

    return 'unknown'
}

export async function login(formData: FormData) {
    const supabase = await createClient()
    const email = (formData.get('email') as string | null)?.trim().toLowerCase() || ''
    const password = (formData.get('password') as string | null) || ''

    // type-casting here for convenience
    // in practice, you should validate your inputs
    const data = {
        email,
        password,
    }

    const { error } = await supabase.auth.signInWithPassword(data)

    if (error) {
        const code = mapAuthErrorToCode(error.message)
        redirect(`/login?error=${encodeURIComponent(code)}`)
    }

    revalidatePath('/', 'layout')
    redirect('/')
}

export async function signup(formData: FormData) {
    const supabase = await createClient()
    const email = (formData.get('email') as string | null)?.trim().toLowerCase() || ''
    const password = (formData.get('password') as string | null) || ''

    const data = {
        email,
        password,
    }

    // Generate a random user name or "Adventurer"
    const { error } = await supabase.auth.signUp({
        ...data,
        options: {
            data: {
                full_name: '冒険者',
                avatar_url: `https://i.pravatar.cc/150?u=${data.email}`
            }
        }
    })

    if (error) {
        const code = mapAuthErrorToCode(error.message)
        redirect(`/login?signup_error=${encodeURIComponent(code)}`)
    }

    // After signup, redirect to login with success message 
    // to avoid confusion if email confirmation is on or slow
    revalidatePath('/', 'layout')
    redirect('/login?success=true')
}
