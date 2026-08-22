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
  const loadProfile=useCallback(async(current:Session|null)=>{setSession(current);setProfile(null);setProfileError(null);if(!current){setLoading(false);return;}try{const value=await getOwnProfile();if(!value)setProfileError('Akun belum dikonfigurasi untuk CertiTrack.');else if(value.status!=='Aktif')setProfileError('Akun tidak aktif.');else setProfile(value);}catch{setProfileError('Profil akun tidak dapat dimuat. Hubungi administrator.');}finally{setLoading(false);}},[]);
  useEffect(()=>{void supabase.auth.getSession().then(({data})=>loadProfile(data.session));const {data}=supabase.auth.onAuthStateChange((_event,next)=>{setLoading(true);void loadProfile(next);});return()=>data.subscription.unsubscribe();},[loadProfile]);
  const value=useMemo<AuthValue>(()=>({session,profile,loading,profileError,login:async(email,password)=>{setLoading(true);try{await signIn(email,password);}catch(error){setLoading(false);throw error;}},logout:async()=>{setLoading(true);try{await signOut();}finally{setSession(null);setProfile(null);setLoading(false);}}}),[session,profile,loading,profileError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
// Auth hook is colocated so Provider and consumers share one private context.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth():AuthValue{const value=useContext(AuthContext);if(!value)throw new Error('useAuth harus digunakan di dalam AuthProvider');return value;}
