import { Clock3,ShieldCheck } from 'lucide-react';
import { LTP_STATUS } from '../../../lib/enums';
import type { LtpWorkflowContext } from '../../../lib/ltpWorkflowTypes';
import { Card } from '../../ui';

const dateTime=(value:string)=>new Date(value).toLocaleString('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});

export function LtpManagerReview({context}:{context:LtpWorkflowContext}){
  if(context.ltp.status!==LTP_STATUS.MANAGER_REVIEW)return null;
  const submission=[...context.workflow_events].reverse().find(event=>event.event_type==='AUDITEE_SUBMITTED_TO_MANAGER');
  const manager=context.permissions.can_review_manager;

  return <Card className="p-5 border-l-4 border-amber-400">
    <div className="flex items-start gap-3">
      <ShieldCheck className="text-amber-600 mt-0.5" size={20}/>
      <div className="flex-1">
        <h2 className="font-semibold">7. Review Section Manager</h2>
        <p className="text-sm text-gray-600 mt-1">
          {manager
            ?'LTP ini telah dikirim oleh Auditee dan sekarang berada pada antrean review Anda.'
            :'LTP telah dikirim dan sedang menunggu review Section Manager.'}
        </p>
        {submission&&<div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
          <span>Dikirim oleh: <strong className="text-gray-700">{submission.actor_name??'Auditee'}</strong></span>
          <span className="inline-flex items-center gap-1"><Clock3 size={12}/>{dateTime(submission.created_at)}</span>
        </div>}
        {manager&&<p className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-md p-2">
          Isi LTP bersifat read-only pada slice ini. Keputusan Setujui/Kembalikan akan diaktifkan pada tahap workflow berikutnya.
        </p>}
      </div>
    </div>
  </Card>;
}
