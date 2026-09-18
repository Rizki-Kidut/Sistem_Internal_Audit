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

export async function getOwnProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if(!data)return null;
  const {data:isLead,error:capabilityError}=await supabase.rpc('current_auditor_is_lead_auditor');
  if(capabilityError)throw new Error(capabilityError.message);
  return {...data,is_company_lead_auditor:isLead===true} as UserProfile;
}
