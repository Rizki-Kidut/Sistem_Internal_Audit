import { useState } from 'react';
import { CheckCircle2,Clock3,RotateCcw,ShieldCheck } from 'lucide-react';
import { LTP_STATUS } from '../../../lib/enums';
import type { LtpManagerDecision,LtpWorkflowContext,LtpWorkflowEvent } from '../../../lib/ltpWorkflowTypes';
import { managerDecideLtp } from '../../../services/ltpService';
import { Button,Card } from '../../ui';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Field,Textarea } from '../../ui/Field';

const dateTime=(value:string)=>{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'-':date.toLocaleString('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
};

const actorFallback:Record<LtpWorkflowEvent['actor_identity_type'],string>={
  ADMIN:'Admin/QMS',AUDITOR:'Auditor',AUDITEE:'Auditee',SECTION_MANAGER:'Section Manager',
};

const historyLabel=(event:LtpWorkflowEvent)=>{
  if(event.event_type==='AUDITEE_SUBMITTED_TO_MANAGER'&&event.from_status===LTP_STATUS.AUDITEE_DRAFT&&event.to_status===LTP_STATUS.MANAGER_REVIEW)return 'Auditee mengirim LTP ke Section Manager';
  if(event.event_type==='AUDITEE_SUBMITTED_TO_MANAGER'&&event.from_status===LTP_STATUS.AUDITEE_RETURNED&&event.to_status===LTP_STATUS.MANAGER_REVIEW)return 'Auditee mengirim ulang LTP ke Section Manager';
  if(event.event_type==='MANAGER_RETURNED_TO_AUDITEE'&&event.from_status===LTP_STATUS.MANAGER_REVIEW&&event.to_status===LTP_STATUS.AUDITEE_RETURNED)return 'Section Manager mengembalikan LTP ke Auditee';
  if(event.event_type==='MANAGER_APPROVED_TO_AUDITOR'&&event.from_status===LTP_STATUS.MANAGER_REVIEW&&event.to_status===LTP_STATUS.AUDITOR_REVIEW)return 'Section Manager menyetujui LTP dan mengirim ke Auditor';
  return null;
};

export function LtpManagerReview({context,onRefresh}:{context:LtpWorkflowContext;onRefresh:()=>Promise<void>}){
  const [comment,setComment]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[confirm,setConfirm]=useState<LtpManagerDecision|null>(null);
  const isManagerReview=context.ltp.status===LTP_STATUS.MANAGER_REVIEW;
  const isManagerReturned=context.ltp.status===LTP_STATUS.AUDITEE_RETURNED;
  const isManagerApproved=context.ltp.status===LTP_STATUS.AUDITOR_REVIEW;
  if(!isManagerReview&&!isManagerReturned&&!isManagerApproved)return null;
  const submission=[...context.workflow_events].reverse().find(event=>event.event_type==='AUDITEE_SUBMITTED_TO_MANAGER');
  const decision=[...context.workflow_events].reverse().find(event=>event.event_type===(isManagerReturned?'MANAGER_RETURNED_TO_AUDITEE':'MANAGER_APPROVED_TO_AUDITOR'));
  const history=context.workflow_events
    .flatMap(event=>{const label=historyLabel(event);return label?[{event,label}]:[];})
    .sort((a,b)=>{
      const aTime=Date.parse(a.event.created_at),bTime=Date.parse(b.event.created_at);
      return (Number.isNaN(aTime)?Number.MAX_SAFE_INTEGER:aTime)-(Number.isNaN(bTime)?Number.MAX_SAFE_INTEGER:bTime)||a.event.id.localeCompare(b.event.id);
    });
  const manager=isManagerReview&&context.permissions.can_review_manager;
  const approveBlocked=context.manager_approve_blockers.length>0;
  const returnBlocked=context.manager_return_blockers.length>0;

  const decide=async(decision:LtpManagerDecision)=>{
    setConfirm(null);setBusy(true);setError(null);
    try{
      await managerDecideLtp(context.ltp.id,context.ltp.revision_version,decision,comment);
      await onRefresh();
    }catch(e){setError(e instanceof Error?e.message:'Gagal memproses keputusan Section Manager');}
    finally{setBusy(false);}
  };

  return <>
    <Card className="p-5 border-l-4 border-amber-400">
      <div className="flex items-start gap-3">
        <ShieldCheck className="text-amber-600 mt-0.5" size={20}/>
        <div className="flex-1">
          <h2 className="font-semibold">7. Review Section Manager</h2>
          <p className="text-sm text-gray-600 mt-1">
            {isManagerReview
              ?'LTP telah dikirim dan sedang menunggu review Section Manager.'
              :isManagerReturned
                ?'LTP telah dikembalikan ke Auditee untuk direvisi.'
                :'LTP telah disetujui Section Manager dan diteruskan ke Auditor untuk verifikasi.'}
          </p>
          {isManagerReview&&submission&&<div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
            <span>Dikirim oleh: <strong className="text-gray-700">{submission.actor_name??'Auditee'}</strong></span>
            <span className="inline-flex items-center gap-1"><Clock3 size={12}/>{dateTime(submission.created_at)}</span>
          </div>}
          {!isManagerReview&&decision&&<div className="mt-3 text-xs text-gray-500 space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>{isManagerReturned?'Dikembalikan':'Disetujui'} oleh: <strong className="text-gray-700">{decision.actor_name??'Section Manager'}</strong></span>
              <span className="inline-flex items-center gap-1"><Clock3 size={12}/>{dateTime(decision.created_at)}</span>
            </div>
            {decision.comment?.trim()&&<div><span>Catatan Manager:</span> <strong className="text-gray-700 whitespace-pre-wrap">{decision.comment}</strong></div>}
          </div>}

          {manager&&<div className="mt-4 space-y-3">
            <div className="text-xs text-amber-700 bg-amber-50 rounded-md p-2">
              Isi LTP tetap read-only bagi Section Manager. Pilih Setujui untuk meneruskan ke verifikasi Auditor, atau Kembalikan agar Auditee dapat merevisi LTP.
            </div>
            <Field label="Catatan Section Manager">
              <Textarea rows={3} value={comment} disabled={busy} placeholder="Wajib diisi jika LTP dikembalikan; opsional jika disetujui." onChange={e=>setComment(e.target.value)}/>
            </Field>
            {error&&<div className="p-3 rounded-lg text-sm bg-red-50 text-red-700">{error}</div>}

            {approveBlocked&&<div className="text-xs text-amber-800 bg-amber-50 rounded-md p-3">
              <p className="font-medium mb-1">Setujui belum dapat diproses:</p>
              <ul className="list-disc pl-5 space-y-1">{context.manager_approve_blockers.map(item=><li key={item}>{item}</li>)}</ul>
            </div>}
            {returnBlocked&&<div className="text-xs text-amber-800 bg-amber-50 rounded-md p-3">
              <p className="font-medium mb-1">Kembalikan belum dapat diproses:</p>
              <ul className="list-disc pl-5 space-y-1">{context.manager_return_blockers.map(item=><li key={item}>{item}</li>)}</ul>
            </div>}

            <div className="flex flex-wrap gap-2">
              <Button variant="danger" disabled={busy||returnBlocked||!comment.trim()} onClick={()=>setConfirm('RETURN')}><RotateCcw size={16}/> Kembalikan ke Auditee</Button>
              <Button disabled={busy||approveBlocked} onClick={()=>setConfirm('APPROVE')}><CheckCircle2 size={16}/> Setujui & Kirim ke Auditor</Button>
            </div>
          </div>}

          <div className="border-t mt-5 pt-4">
            <h3 className="font-semibold text-sm mb-3">Riwayat Review & Persetujuan</h3>
            {history.length?<div className="space-y-3">
              {history.map(({event,label})=><div key={event.id} className="relative border-l-2 border-blue-300 pl-4 pb-1 text-sm">
                <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-blue-500"/>
                <div className="font-medium text-gray-800">{label}</div>
                <div className="text-xs text-gray-500 mt-1">Oleh: <span className="font-medium text-gray-700">{event.actor_name?.trim()||actorFallback[event.actor_identity_type]}</span></div>
                <div className="text-xs text-gray-500 mt-0.5 inline-flex items-center gap-1"><Clock3 size={12}/>{dateTime(event.created_at)}</div>
                {event.comment?.trim()&&<div className="mt-2 rounded-md bg-gray-50 p-2 text-xs text-gray-700">
                  <div className="font-medium mb-1">Catatan:</div>
                  <div className="whitespace-pre-wrap">{event.comment}</div>
                </div>}
              </div>)}
            </div>:<p className="text-sm text-gray-500">Belum ada riwayat review.</p>}
          </div>
        </div>
      </div>
    </Card>

    <ConfirmDialog
      open={confirm==='RETURN'}
      title="Kembalikan LTP ke Auditee?"
      message="LTP akan kembali dapat diedit oleh Auditee. Catatan Section Manager disimpan permanen di riwayat workflow dan Auditee akan menerima notifikasi revisi."
      confirmLabel="Ya, Kembalikan"
      variant="danger"
      onConfirm={()=>void decide('RETURN')}
      onCancel={()=>setConfirm(null)}
    />
    <ConfirmDialog
      open={confirm==='APPROVE'}
      title="Setujui LTP?"
      message="LTP akan diteruskan ke tahap Verifikasi Auditor dan tidak lagi dapat diedit oleh Auditee maupun Section Manager."
      confirmLabel="Ya, Setujui"
      variant="info"
      onConfirm={()=>void decide('APPROVE')}
      onCancel={()=>setConfirm(null)}
    />
  </>;
}
