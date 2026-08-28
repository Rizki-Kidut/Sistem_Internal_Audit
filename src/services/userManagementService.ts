import { supabase } from '../lib/supabaseClient';
import type { InvitedUser,ManagedUser,SaveManagedUserAccessInput } from '../lib/userManagementTypes';
import type { IdentityStatus } from '../lib/auth';

export async function listManagedUsers():Promise<ManagedUser[]>{
  const {data,error}=await supabase.rpc('admin_list_user_management');
  if(error)throw new Error(`Gagal memuat user: ${error.message}`);
  return (data??[]) as ManagedUser[];
}

export async function inviteManagedUser(email:string,displayName:string):Promise<InvitedUser>{
  const {data,error}=await supabase.functions.invoke('admin-invite-user',{body:{email,display_name:displayName}});
  if(error)throw new Error(`Gagal mengundang user: ${error.message}`);
  if(data?.error)throw new Error(`Gagal mengundang user: ${data.error}`);
  if(!data?.user?.id)throw new Error('User hasil invite tidak tersedia');
  return data.user as InvitedUser;
}

export async function saveManagedUserAccess(input:SaveManagedUserAccessInput):Promise<void>{
  const {error}=await supabase.rpc('admin_save_user_access',{
    p_user_id:input.user_id,
    p_display_name:input.display_name,
    p_nik:input.nik,
    p_role:input.role,
    p_status:input.status,
    p_auditor_id:input.auditor_id,
    p_plan_id:input.plan_id,
    p_team_id:input.team_id,
    p_seksi_id:input.seksi_id,
  });
  if(error)throw new Error(`Gagal menyimpan akses user: ${error.message}`);
}

export async function setManagedAnnualAssignmentStatus(id:string,status:IdentityStatus):Promise<void>{
  const {error}=await supabase.rpc('admin_set_user_audit_assignment_status',{p_assignment_id:id,p_status:status});
  if(error)throw new Error(`Gagal mengubah assignment Auditor: ${error.message}`);
}
