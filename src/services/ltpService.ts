import { supabase } from '../lib/supabaseClient';
import type { LtpActionEvidence,LtpDraftPayload,LtpWorklistRow } from '../lib/types';
import type { LtpAdminDecision,LtpAuditorVerificationResult,LtpManagerDecision,LtpNotification,LtpWorkflowContext } from '../lib/ltpWorkflowTypes';
import type { LtpEvidenceState } from '../lib/enums';

const BUCKET='audit-evidence';
const LTP_NOTIFICATION_TYPES=['LTP_MANAGER_REVIEW','LTP_AUDITEE_RETURNED','LTP_AUDITOR_REVIEW','LTP_ADMIN_REVIEW','LTP_AUDITOR_RETURNED','LTP_CLOSED'] as const;
export const LTP_STALE_MESSAGE='LTP telah berubah di sesi lain. Muat ulang data sebelum menyimpan kembali.';

export async function listLtpWorklist():Promise<LtpWorklistRow[]>{
  const {data,error}=await supabase.rpc('list_ltp_worklist');
  if(error)throw new Error(`Gagal memuat worklist LTP: ${error.message}`);
  return(data??[]) as LtpWorklistRow[];
}

export async function listOwnLtpNotifications():Promise<LtpNotification[]>{
  const {data,error}=await supabase.from('notifications').select('*').in('notification_type',[...LTP_NOTIFICATION_TYPES]).order('created_at',{ascending:false}).limit(20);
  if(error)throw new Error(`Gagal memuat notifikasi LTP: ${error.message}`);
  return(data??[]) as LtpNotification[];
}

export async function markLtpNotificationRead(id:string):Promise<void>{
  const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);
  if(error)throw new Error(`Gagal menandai notifikasi LTP: ${error.message}`);
}

export async function saveLtpAuditeeDraft(payload:LtpDraftPayload):Promise<number>{
  const {data,error}=await supabase.rpc('save_ltp_auditee_draft',{
    p_car_id:payload.car_id,p_expected_revision:payload.expected_revision,
    p_dampak_temuan:payload.dampak_temuan,p_manfaat_perbaikan:payload.manfaat_perbaikan,
    p_why_analysis:payload.why_analysis.map(({teks})=>({teks})),
    p_actions:payload.actions.map(({id,action_type,description,pic,due_date})=>({id:id??null,action_type,description,pic,due_date})),
    p_system_revisions:payload.system_revisions.map(({kategori,nama_dokumen})=>({kategori,nama_dokumen})),
  });
  if(error){if(error.message.includes('LTP_STALE_REVISION'))throw new Error(LTP_STALE_MESSAGE);throw new Error(`Gagal menyimpan Draft LTP: ${error.message}`);}
  return data as number;
}

export async function submitLtpToManager(carId:string,expectedRevision:number):Promise<number>{
  const {data,error}=await supabase.rpc('submit_ltp_to_manager',{p_car_id:carId,p_expected_revision:expectedRevision});
  if(error){
    if(error.message.includes('LTP_STALE_REVISION'))throw new Error(LTP_STALE_MESSAGE);
    if(error.message.includes('LTP_SUBMIT_BLOCKED:')){
      const detail=error.message.split('LTP_SUBMIT_BLOCKED:')[1]?.trim();
      throw new Error(detail||'LTP belum memenuhi syarat untuk dikirim ke Section Manager.');
    }
    throw new Error(`Gagal mengirim LTP ke Section Manager: ${error.message}`);
  }
  return data as number;
}

export async function managerDecideLtp(carId:string,expectedRevision:number,decision:LtpManagerDecision,comment:string):Promise<number>{
  const {data,error}=await supabase.rpc('manager_decide_ltp',{
    p_car_id:carId,
    p_expected_revision:expectedRevision,
    p_decision:decision,
    p_comment:comment.trim()||null,
  });
  if(error){
    if(error.message.includes('LTP_STALE_REVISION'))throw new Error(LTP_STALE_MESSAGE);
    if(error.message.includes('LTP_MANAGER_RETURN_COMMENT_REQUIRED'))throw new Error('Catatan Section Manager wajib diisi ketika LTP dikembalikan ke Auditee.');
    if(error.message.includes('LTP_MANAGER_APPROVE_BLOCKED:')){
      const detail=error.message.split('LTP_MANAGER_APPROVE_BLOCKED:')[1]?.trim();
      throw new Error(detail||'LTP belum dapat dikirim ke tahap verifikasi Auditor.');
    }
    if(error.message.includes('LTP_MANAGER_RETURN_BLOCKED:')){
      const detail=error.message.split('LTP_MANAGER_RETURN_BLOCKED:')[1]?.trim();
      throw new Error(detail||'LTP belum dapat dikembalikan ke Auditee.');
    }
    throw new Error(`Gagal memproses keputusan Section Manager: ${error.message}`);
  }
  return data as number;
}

export async function auditorVerifyLtp(carId:string,expectedRevision:number,result:LtpAuditorVerificationResult,comment:string):Promise<number>{
  const {data,error}=await supabase.rpc('auditor_verify_ltp',{
    p_car_id:carId,
    p_expected_revision:expectedRevision,
    p_result:result,
    p_comment:comment.trim()||null,
  });
  if(error){
    if(error.message.includes('LTP_STALE_REVISION'))throw new Error(LTP_STALE_MESSAGE);
    if(error.message.includes('LTP_AUDITOR_OPEN_COMMENT_REQUIRED'))throw new Error('Catatan Auditor wajib diisi ketika hasil verifikasi Open.');
    if(error.message.includes('LTP_AUDITOR_OPEN_BLOCKED:')){
      const detail=error.message.split('LTP_AUDITOR_OPEN_BLOCKED:')[1]?.trim();
      throw new Error(detail||'LTP belum dapat dikembalikan ke Auditee.');
    }
    if(error.message.includes('LTP_AUDITOR_CLOSE_BLOCKED:')){
      const detail=error.message.split('LTP_AUDITOR_CLOSE_BLOCKED:')[1]?.trim();
      throw new Error(detail||'LTP belum dapat dikirim ke Admin/QMS.');
    }
    throw new Error(`Gagal memproses verifikasi Auditor: ${error.message}`);
  }
  return data as number;
}

function sanitizeFileName(name:string):string{return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-')||'file';}

export async function adminDecideLtp(carId:string,expectedRevision:number,decision:LtpAdminDecision,comment:string):Promise<number>{
  const {data,error}=await supabase.rpc('admin_decide_ltp',{p_car_id:carId,p_expected_revision:expectedRevision,p_decision:decision,p_comment:comment.trim()||null});
  if(error){
    if(error.message.includes('LTP_STALE_REVISION'))throw new Error(LTP_STALE_MESSAGE);
    if(error.message.includes('LTP_ADMIN_RETURN_COMMENT_REQUIRED'))throw new Error('Catatan Admin/QMS wajib diisi ketika LTP dikembalikan ke Auditor.');
    if(error.message.includes('LTP_ADMIN_RETURN_BLOCKED:'))throw new Error(error.message.split('LTP_ADMIN_RETURN_BLOCKED:')[1]?.trim()||'LTP belum dapat dikembalikan ke Auditor.');
    if(error.message.includes('LTP_ADMIN_APPROVE_BLOCKED:'))throw new Error(error.message.split('LTP_ADMIN_APPROVE_BLOCKED:')[1]?.trim()||'LTP belum dapat ditutup.');
    if(error.message.includes('Admin tidak diizinkan'))throw new Error('Anda tidak memiliki kewenangan untuk memutuskan LTP ini.');
    throw new Error(`Gagal memproses keputusan Admin/QMS: ${error.message}`);
  }
  return data as number;
}

export async function uploadLtpActionEvidence(carId:string,actionId:string,state:LtpEvidenceState,file:File):Promise<void>{
  if(!actionId)throw new Error('Simpan Draft terlebih dahulu untuk mengaktifkan upload bukti.');
  const path=`ltp/${carId}/${actionId}/${state}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const {error:uploadError}=await supabase.storage.from(BUCKET).upload(path,file,{contentType:file.type||undefined,upsert:false});
  if(uploadError)throw new Error(`Gagal mengunggah bukti LTP: ${uploadError.message}`);
  const {error}=await supabase.rpc('register_ltp_action_evidence',{p_action_id:actionId,p_evidence_state:state,p_file_name:file.name,p_path:path,p_mime_type:file.type||null,p_size_bytes:file.size});
  if(error){await supabase.storage.from(BUCKET).remove([path]);throw new Error(`Gagal mencatat bukti LTP: ${error.message}`);}
}

export async function deleteLtpActionEvidence(evidence:LtpActionEvidence):Promise<void>{
  const {data,error}=await supabase.rpc('delete_ltp_action_evidence',{p_evidence_id:evidence.id});
  if(error)throw new Error(`Gagal menghapus bukti LTP: ${error.message}`);
  const path=(data as string)||evidence.path;
  const {error:storageError}=await supabase.storage.from(BUCKET).remove([path]);
  if(storageError)throw new Error(`Metadata bukti terhapus, tetapi file Storage gagal dibersihkan: ${storageError.message}`);
}

export async function getLtpEvidenceSignedUrl(path:string):Promise<string>{
  const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(path,60*10);
  if(error)throw new Error(`Gagal membuka bukti LTP: ${error.message}`);
  return data.signedUrl;
}

export async function getLtpContext(carId:string):Promise<LtpWorkflowContext>{
  if(!carId)throw new Error('ID LTP wajib diisi');
  const {data,error}=await supabase.rpc('get_ltp_context',{p_car_id:carId});
  if(error)throw new Error(`Gagal memuat konteks LTP: ${error.message}`);
  if(!data)throw new Error('LTP tidak ditemukan atau tidak dapat diakses');
  return data as LtpWorkflowContext;
}
