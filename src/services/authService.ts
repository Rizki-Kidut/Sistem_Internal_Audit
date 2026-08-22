import { supabase } from '../lib/supabaseClient';
import type { UserProfile } from '../lib/auth';

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getOwnProfile(): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('user_profiles').select('*').maybeSingle();
  if (error) throw new Error(error.message);
  return data as UserProfile | null;
}
