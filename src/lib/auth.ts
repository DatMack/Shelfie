import { supabase } from './supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Shelfie is not connected to Supabase.')
  return supabase
}

function authRedirectUrl() {
  if (typeof window === 'undefined') return undefined
  return new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString()
}

export async function signUpWithEmail({
  email,
  password,
  username,
  displayName,
}: {
  email: string
  password: string
  username: string
  displayName?: string
}) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: authRedirectUrl(),
      data: {
        username: username.trim(),
        display_name: displayName?.trim() || username.trim(),
      },
    },
  })
  if (error) throw error
  return data
}

export async function signInWithEmail(email: string, password: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
  return data
}

export async function resendConfirmationEmail(email: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: authRedirectUrl() },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const client = requireSupabase()
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  return data.session
}
