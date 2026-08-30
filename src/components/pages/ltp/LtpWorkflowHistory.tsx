import { Clock3 } from 'lucide-react';
import { LTP_STATUS } from '../../../lib/enums';
import type { LtpWorkflowContext,LtpWorkflowEvent } from '../../../lib/ltpWorkflowTypes';
import { Card } from '../../ui';

const actorFallback:Record<LtpWorkflowEvent['actor_identity_type'],string>={
  ADMIN:'Admin/QMS',AUDITOR:'Auditor',AUDITEE:'Auditee',SECTION_MANAGER:'Section Manager',
};

const dateTime=(value:string)=>{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'-':date.toLocaleString('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
};

const historyLabel=(event:LtpWorkflowEvent)=>{
  if(event.event_type==='AUDITEE_SUBMITTED_TO_MANAGER'&&event.from_status===LTP_STATUS.AUDITEE_DRAFT&&event.to_status===LTP_STATUS.MANAGER_REVIEW)return 'Auditee mengirim LTP ke Section Manager';
  if(event.event_type==='AUDITEE_SUBMITTED_TO_MANAGER'&&event.from_status===LTP_STATUS.AUDITEE_RETURNED&&event.to_status===LTP_STATUS.MANAGER_REVIEW)return 'Auditee mengirim ulang LTP ke Section Manager';
  if(event.event_type==='MANAGER_RETURNED_TO_AUDITEE'&&event.from_status===LTP_STATUS.MANAGER_REVIEW&&event.to_status===LTP_STATUS.AUDITEE_RETURNED)return 'Section Manager mengembalikan LTP ke Auditee';
  if(event.event_type==='MANAGER_APPROVED_TO_AUDITOR'&&event.from_status===LTP_STATUS.MANAGER_REVIEW&&event.to_status===LTP_STATUS.AUDITOR_REVIEW)return 'Section Manager menyetujui LTP dan mengirim ke Auditor';
  if(event.event_type==='AUDITOR_VERIFIED_OPEN_TO_AUDITEE'&&event.from_status===LTP_STATUS.AUDITOR_REVIEW&&event.to_status===LTP_STATUS.AUDITEE_RETURNED)return 'Auditor memverifikasi Open dan mengembalikan LTP ke Auditee';
  if(event.event_type==='AUDITOR_VERIFIED_CLOSE_TO_ADMIN'&&event.from_status===LTP_STATUS.AUDITOR_REVIEW&&event.to_status===LTP_STATUS.ADMIN_REVIEW)return 'Auditor memverifikasi Close dan mengirim LTP ke Admin/QMS';
  return null;
};

export function LtpWorkflowHistory({context}:{context:LtpWorkflowContext}){
  const history=context.workflow_events
    .flatMap(event=>{const label=historyLabel(event);return label?[{event,label}]:[];})
    .sort((a,b)=>{
      const aTime=Date.parse(a.event.created_at),bTime=Date.parse(b.event.created_at);
      return (Number.isNaN(aTime)?Number.MAX_SAFE_INTEGER:aTime)-(Number.isNaN(bTime)?Number.MAX_SAFE_INTEGER:bTime)||a.event.id.localeCompare(b.event.id);
    });

  return <Card className="p-5">
    <h2 className="font-semibold mb-4">Riwayat Review & Persetujuan</h2>
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
  </Card>;
}
