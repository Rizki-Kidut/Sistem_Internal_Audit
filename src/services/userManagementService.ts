import { supabase } from '../lib/supabaseClient';
import type { ManagedUser,ProvisionedUser,SaveManagedUserAccessInput } from '../lib/userManagementTypes';
import type { IdentityStatus } from '../lib/auth';

export async function listManagedUsers():Promise<ManagedUser[]>{
  const {data,error}=await supabase.rpc('admin_list_user_management');
  if(error)throw new Error(`Gagal memuat user: ${error.message}`);
  return (data??[]) as ManagedUser[];
}

export async function createManagedUser(email:string,displayName:string):Promise<ProvisionedUser>{
  const {data,error}=await supabase.functions.invoke('admin-create-user',{body:{email,display_name:displayName}});
  if(data?.error)throw new Error(`Gagal membuat user: ${data.error}`);
  if(error){
    let detail=error.message;
    if('context' in error&&error.context instanceof Response){
      const body=await error.context.clone().json().catch(()=>null) as {error?:string}|null;
      if(body?.error)detail=body.error;
    }
    throw new Error(`Gagal membuat user: ${detail}`);
  }
  if(!data?.user?.id)throw new Error('User Auth hasil provisioning tidak tersedia');
  return data.user as ProvisionedUser;
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
