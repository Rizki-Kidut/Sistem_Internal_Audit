import { useState } from 'react';
import { CheckCircle2,Clock3,RotateCcw,ShieldCheck } from 'lucide-react';
import { LTP_STATUS } from '../../../lib/enums';
import type { LtpAdminDecision,LtpWorkflowContext } from '../../../lib/ltpWorkflowTypes';
import { adminDecideLtp } from '../../../services/ltpService';
import { Button,Card } from '../../ui';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Field,Textarea } from '../../ui/Field';

const dateTime=(value:string)=>new Date(value).toLocaleString('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});

export function LtpAdminReview({context,onRefresh}:{context:LtpWorkflowContext;onRefresh:()=>Promise<void>}){
  const [comment,setComment]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[confirm,setConfirm]=useState<LtpAdminDecision|null>(null);
  const isReview=context.ltp.status===LTP_STATUS.ADMIN_REVIEW;
  const latest=[...context.workflow_events].reverse().find(event=>event.event_type==='ADMIN_RETURNED_TO_AUDITOR'||event.event_type==='ADMIN_APPROVED_LTP');
  if(!isReview&&!latest)return null;
  const canReview=isReview&&context.permissions.can_review_admin;
  const decide=async(decision:LtpAdminDecision)=>{setConfirm(null);setBusy(true);setError(null);try{await adminDecideLtp(context.ltp.id,context.ltp.revision_version,decision,comment);setComment('');await onRefresh();}catch(e){setError(e instanceof Error?e.message:'Gagal memproses keputusan Admin/QMS');}finally{setBusy(false);}};
  return <>
    <Card className="p-5 border-l-4 border-indigo-500"><div className="flex items-start gap-3"><ShieldCheck className="text-indigo-600 mt-0.5" size={20}/><div className="flex-1">
      <h2 className="font-semibold">9. Keputusan Admin/QMS</h2>
      {isReview?<p className="text-sm text-gray-600 mt-1">Status: <strong>Menunggu Keputusan Admin/QMS</strong></p>:latest&&<div className="mt-2 text-sm space-y-2">
        <div>Keputusan: <strong>{latest.event_type==='ADMIN_APPROVED_LTP'?'Disetujui':'Dikembalikan ke Auditor'}</strong></div>
        {latest.event_type==='ADMIN_APPROVED_LTP'&&<div>Status: <strong>LTP Ditutup</strong></div>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span>Diputuskan oleh: <strong className="text-gray-700">{latest.actor_name?.trim()||'Admin/QMS'}</strong></span><span className="inline-flex items-center gap-1"><Clock3 size={12}/>{dateTime(latest.created_at)}</span></div>
        {latest.comment?.trim()&&<div className="text-xs text-gray-600">Catatan Admin/QMS: <strong className="text-gray-700 whitespace-pre-wrap">{latest.comment}</strong></div>}
      </div>}
      {isReview&&latest&&<div className="mt-3 rounded-md bg-gray-50 p-3 text-xs text-gray-600">Keputusan sebelumnya: <strong>{latest.event_type==='ADMIN_RETURNED_TO_AUDITOR'?'Dikembalikan ke Auditor':'Disetujui'}</strong> oleh {latest.actor_name?.trim()||'Admin/QMS'} pada {dateTime(latest.created_at)}.</div>}
      {canReview&&<div className="mt-4 space-y-3"><Field label="Catatan Admin/QMS"><Textarea rows={3} value={comment} disabled={busy} placeholder="Wajib ketika dikembalikan; opsional ketika disetujui." onChange={event=>setComment(event.target.value)}/></Field>
        {error&&<div className="p-3 rounded-lg text-sm bg-red-50 text-red-700">{error}</div>}
        <div className="flex flex-wrap gap-2"><Button variant="danger" disabled={busy||context.admin_return_blockers.length>0||!comment.trim()} onClick={()=>setConfirm('RETURN')}><RotateCcw size={16}/> Kembalikan ke Auditor</Button><Button disabled={busy||context.admin_approve_blockers.length>0} onClick={()=>setConfirm('APPROVE')}><CheckCircle2 size={16}/> Setujui &amp; Tutup LTP</Button></div>
        {(context.admin_return_blockers.length>0||context.admin_approve_blockers.length>0)&&<div className="text-xs text-amber-800 bg-amber-50 rounded-md p-3">{[...new Set([...context.admin_return_blockers,...context.admin_approve_blockers])].join(' ')}</div>}
      </div>}
    </div></div></Card>
    <ConfirmDialog open={confirm==='RETURN'} title="Kembalikan LTP ke Auditor?" message="Auditor akan meninjau catatan Admin/QMS dan melakukan verifikasi ulang." confirmLabel="Ya, Kembalikan" variant="danger" onConfirm={()=>void decide('RETURN')} onCancel={()=>setConfirm(null)}/>
    <ConfirmDialog open={confirm==='APPROVE'} title="Setujui dan tutup LTP?" message="Workflow LTP akan ditutup. Status Finding belum berubah sampai sinkronisasi Batch 7g." confirmLabel="Ya, Setujui & Tutup" variant="info" onConfirm={()=>void decide('APPROVE')} onCancel={()=>setConfirm(null)}/>
  </>;
}
