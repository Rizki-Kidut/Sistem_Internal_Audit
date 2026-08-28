import type { LtpContext } from './types';

export interface LtpWorkflowEvent {
  id: string;
  event_type: string;
  actor_user_id: string;
  actor_identity_type: 'ADMIN' | 'AUDITOR' | 'AUDITEE' | 'SECTION_MANAGER';
  actor_name: string | null;
  comment: string | null;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
}

export type LtpNotificationType = 'LTP_MANAGER_REVIEW' | 'LTP_AUDITEE_RETURNED' | 'LTP_AUDITOR_REVIEW';
export type LtpManagerDecision = 'APPROVE' | 'RETURN';

export interface LtpNotification {
  id: string;
  finding_id: string | null;
  notification_type: LtpNotificationType;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export type LtpWorkflowContext = Omit<LtpContext, 'permissions'> & {
  permissions: LtpContext['permissions'] & {
    can_submit_auditee: boolean;
    can_review_manager: boolean;
  };
  submit_blockers: string[];
  manager_approve_blockers: string[];
  manager_return_blockers: string[];
  workflow_events: LtpWorkflowEvent[];
};
