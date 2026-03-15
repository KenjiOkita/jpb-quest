'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
        redirect(`/error?message=${encodeURIComponent(error.message)}`)
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
        redirect(`/error?message=${encodeURIComponent(error.message)}`)
    }

    // After signup, redirect to login with success message 
    // to avoid confusion if email confirmation is on or slow
    revalidatePath('/', 'layout')
    redirect('/login?success=true')
}
