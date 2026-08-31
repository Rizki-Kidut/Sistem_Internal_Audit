import { useState } from 'react';
import { CheckCircle2,Clock3,RotateCcw,ShieldCheck } from 'lucide-react';
import { LTP_STATUS } from '../../../lib/enums';
import type { LtpAuditorVerificationResult,LtpWorkflowContext } from '../../../lib/ltpWorkflowTypes';
import { auditorVerifyLtp } from '../../../services/ltpService';
import { Button,Card } from '../../ui';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Field,Textarea } from '../../ui/Field';

const dateTime=(value:string)=>{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'-':date.toLocaleString('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
};

export function LtpAuditorReview({context,onRefresh}:{context:LtpWorkflowContext;onRefresh:()=>Promise<void>}){
  const [comment,setComment]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[confirm,setConfirm]=useState<LtpAuditorVerificationResult|null>(null);
  const isReturned=context.ltp.status===LTP_STATUS.AUDITOR_RETURNED;
  const isReview=context.ltp.status===LTP_STATUS.AUDITOR_REVIEW||isReturned;
  const latestDecision=[...context.workflow_events].reverse().find(event=>event.event_type==='AUDITOR_VERIFIED_OPEN_TO_AUDITEE'||event.event_type==='AUDITOR_VERIFIED_CLOSE_TO_ADMIN');
  const latestAdminReturn=[...context.workflow_events].reverse().find(event=>event.event_type==='ADMIN_RETURNED_TO_AUDITOR');
  if(!isReview&&!latestDecision)return null;
  const canReview=isReview&&context.permissions.can_review_auditor;
  const openBlocked=context.auditor_open_blockers.length>0;
  const closeBlocked=context.auditor_close_blockers.length>0;

  const verify=async(result:LtpAuditorVerificationResult)=>{
    setConfirm(null);setBusy(true);setError(null);
    try{
      await auditorVerifyLtp(context.ltp.id,context.ltp.revision_version,result,comment);
      setComment('');
      await onRefresh();
    }catch(e){setError(e instanceof Error?e.message:'Gagal memproses verifikasi Auditor');}
    finally{setBusy(false);}
  };

  return <>
    <Card className="p-5 border-l-4 border-blue-500">
      <div className="flex items-start gap-3">
        <ShieldCheck className="text-blue-600 mt-0.5" size={20}/>
        <div className="flex-1">
          <h2 className="font-semibold">8. Verifikasi Auditor</h2>
          {isReview?<p className="text-sm text-gray-600 mt-1">Status: <strong>{isReturned?'Dikembalikan Admin/QMS untuk Verifikasi Ulang':'Menunggu Verifikasi Auditor'}</strong></p>:latestDecision&&<div className="mt-2 text-sm space-y-2">
            <div>Hasil Verifikasi: <strong>{latestDecision.event_type==='AUDITOR_VERIFIED_OPEN_TO_AUDITEE'?'Open — Perlu Perbaikan Ulang':'Close'}</strong></div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>Diverifikasi oleh: <strong className="text-gray-700">{latestDecision.actor_name?.trim()||'Auditor'}</strong></span>
              <span className="inline-flex items-center gap-1"><Clock3 size={12}/>{dateTime(latestDecision.created_at)}</span>
            </div>
            {latestDecision.comment?.trim()&&<div className="text-xs text-gray-600">Catatan Auditor: <strong className="text-gray-700 whitespace-pre-wrap">{latestDecision.comment}</strong></div>}
            {latestDecision.event_type==='AUDITOR_VERIFIED_CLOSE_TO_ADMIN'&&<div className="text-xs text-blue-700">Status workflow: <strong>Dikirim ke Admin/QMS</strong></div>}
          </div>}

          {isReview&&latestDecision&&<div className="mt-3 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
            Verifikasi sebelumnya: <strong>{latestDecision.event_type==='AUDITOR_VERIFIED_OPEN_TO_AUDITEE'?'Open — Perlu Perbaikan Ulang':'Close'}</strong> oleh {latestDecision.actor_name?.trim()||'Auditor'} pada {dateTime(latestDecision.created_at)}.
          </div>}
          {isReturned&&latestAdminReturn&&<div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-900"><div className="font-medium">LTP dikembalikan oleh Admin/QMS kepada Auditor.</div><div className="mt-1">Catatan Admin/QMS: <span className="whitespace-pre-wrap font-medium">{latestAdminReturn.comment||'-'}</span></div></div>}

          {canReview&&<div className="mt-4 space-y-3">
            <Field label="Catatan Auditor">
              <Textarea rows={3} value={comment} disabled={busy} placeholder="Wajib untuk hasil Open; opsional untuk Close." onChange={event=>setComment(event.target.value)}/>
            </Field>
            {error&&<div className="p-3 rounded-lg text-sm bg-red-50 text-red-700">{error}</div>}
            {openBlocked&&<Blockers title="Open belum dapat diproses" items={context.auditor_open_blockers}/>}
            {closeBlocked&&<Blockers title="Close belum dapat diproses" items={context.auditor_close_blockers}/>}
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" disabled={busy||openBlocked||!comment.trim()} onClick={()=>setConfirm('OPEN')}><RotateCcw size={16}/> Open — Kembalikan ke Auditee</Button>
              <Button disabled={busy||closeBlocked} onClick={()=>setConfirm('CLOSE')}><CheckCircle2 size={16}/> Close — Kirim ke Admin/QMS</Button>
            </div>
          </div>}
        </div>
      </div>
    </Card>
    <ConfirmDialog open={confirm==='OPEN'} title="Verifikasi Open dan kembalikan LTP?" message="LTP akan kembali dapat diedit oleh Auditee dan wajib melalui Section Manager sebelum diverifikasi Auditor lagi." confirmLabel="Ya, Kembalikan" variant="danger" onConfirm={()=>void verify('OPEN')} onCancel={()=>setConfirm(null)}/>
    <ConfirmDialog open={confirm==='CLOSE'} title="Verifikasi Close dan kirim ke Admin/QMS?" message="LTP akan masuk ke tahap approval Admin/QMS. Keputusan ini belum menutup LTP atau Finding." confirmLabel="Ya, Kirim" variant="info" onConfirm={()=>void verify('CLOSE')} onCancel={()=>setConfirm(null)}/>
  </>;
}

function Blockers({title,items}:{title:string;items:string[]}){return <div className="text-xs text-amber-800 bg-amber-50 rounded-md p-3"><p className="font-medium mb-1">{title}:</p><ul className="list-disc pl-5 space-y-1">{items.map(item=><li key={item}>{item}</li>)}</ul></div>}
