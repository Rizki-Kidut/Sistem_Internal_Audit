import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { UserProfile } from '../lib/auth';
import { getOwnProfile, signIn, signOut } from '../services/authService';

interface AuthValue { session: Session | null; profile: UserProfile | null; loading: boolean; profileError: string | null; login(email:string,password:string):Promise<void>; logout():Promise<void>; }
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,setSession]=useState<Session|null>(null); const [profile,setProfile]=useState<UserProfile|null>(null);
  const [loading,setLoading]=useState(true); const [profileError,setProfileError]=useState<string|null>(null);
  const loadProfile=useCallback(async(current:Session,showGlobalLoading:boolean)=>{if(showGlobalLoading)setLoading(true);setProfileError(null);try{const value=await getOwnProfile(current.user.id);if(!value){setProfile(null);setProfileError('Akun belum dikonfigurasi untuk CertiTrack.');}else if(value.status!=='Aktif'){setProfile(null);setProfileError('Akun tidak aktif.');}else setProfile(value);}catch{setProfile(null);setProfileError('Profil akun tidak dapat dimuat. Hubungi administrator.');}finally{if(showGlobalLoading)setLoading(false);}},[]);
  useEffect(()=>{let active=true;void supabase.auth.getSession().then(({data})=>{if(!active)return;setSession(data.session);if(data.session)void loadProfile(data.session,true);else setLoading(false);});const {data}=supabase.auth.onAuthStateChange((event,next)=>{if(!active)return;setSession(next);if(event==='TOKEN_REFRESHED')return;if(event==='SIGNED_OUT'||!next){setProfile(null);setProfileError(null);setLoading(false);return;}if(event==='SIGNED_IN'){queueMicrotask(()=>{if(active)void loadProfile(next,true);});return;}if(event==='USER_UPDATED'){queueMicrotask(()=>{if(active)void loadProfile(next,false);});}});return()=>{active=false;data.subscription.unsubscribe();};},[loadProfile]);
  const value=useMemo<AuthValue>(()=>({session,profile,loading,profileError,login:async(email,password)=>{setLoading(true);try{await signIn(email,password);}catch(error){setLoading(false);throw error;}},logout:async()=>{setLoading(true);try{await signOut();}finally{setSession(null);setProfile(null);setLoading(false);}}}),[session,profile,loading,profileError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
// Auth hook is colocated so Provider and consumers share one private context.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth():AuthValue{const value=useContext(AuthContext);if(!value)throw new Error('useAuth harus digunakan di dalam AuthProvider');return value;}
