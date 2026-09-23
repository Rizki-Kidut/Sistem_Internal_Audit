import { supabase } from '../lib/supabaseClient';

export type DashboardAuditType = 'ChecklistSistem'|'ChecklistProduk'|'ChecklistManufakturShift'|null;
export interface DashboardFilters { fiscal_year:number; audit_type:DashboardAuditType; process_id:string|null }
export interface DashboardMetric { key:string; label:string; value:number; description:string; page:string|null }
export interface DashboardListItem { label:string; detail?:string; date?:string; page?:string|null; count?:number }
export interface DashboardData {
  scope:{label:string;full_organization:boolean}; fiscal_years:number[]; selected_fiscal_year:number;
  processes:{id:string;name:string}[]; metrics:DashboardMetric[];
  plan_actual:{month:number;label:string;plan:number;actual:number}[];
  execution_status:{label:string;value:number}[];
  finding_health:{open:number;closed:number;pending_review:number;categories:Record<'A'|'B'|'C',number>};
  ltp_health:{open:number;temporary_overdue:number;permanent_overdue:number;verification_pending:number};
  process_findings:{process_id:string;process_name:string;total:number;open:number;overdue_ltp:number;weakness:number}[];
  weaknesses:{label:string;count:number}[]; attention:DashboardListItem[]; my_actions:DashboardListItem[];
  upcoming:DashboardListItem[]; recent_activity:DashboardListItem[];
}
export async function getInternalAuditDashboard(filters:Partial<DashboardFilters>):Promise<DashboardData>{
  const {data,error}=await supabase.rpc('get_internal_audit_dashboard',{p_fiscal_year:filters.fiscal_year??null,p_audit_type:filters.audit_type??null,p_process_id:filters.process_id??null});
  if(error)throw new Error(`Gagal memuat Dashboard Internal Audit: ${error.message}`);
  return data as DashboardData;
}
