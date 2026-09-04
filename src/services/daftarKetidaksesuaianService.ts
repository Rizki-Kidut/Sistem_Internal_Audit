import { formatFindingNarrative } from '../lib/finding';
import type { DaftarKetidaksesuaianAuditOption, DaftarKetidaksesuaianReport, Finding, LtpWorklistRow } from '../lib/types';
import { getFindingContext, listFindings } from './findingService';
import { listLtpWorklist } from './ltpService';

function eligibleFindings(findings:Finding[],ltps:LtpWorklistRow[]):Finding[]{
  const ltpAuditByFindingId=new Map(ltps.map(ltp=>[ltp.finding_id,ltp.kode_audit]));
  return findings.filter(finding=>ltpAuditByFindingId.get(finding.id)===finding.kode_audit);
}

async function loadEligibleFindings():Promise<Finding[]>{
  const [ltps,findings]=await Promise.all([listLtpWorklist(),listFindings()]);
  return eligibleFindings(findings,ltps);
}

export async function listDaftarKetidaksesuaianAudits():Promise<DaftarKetidaksesuaianAuditOption[]>{
  const counts=new Map<string,number>();
  for(const finding of await loadEligibleFindings())counts.set(finding.kode_audit,(counts.get(finding.kode_audit)??0)+1);
  return Array.from(counts,([kode_audit,finding_count])=>({kode_audit,finding_count}))
    .sort((left,right)=>left.kode_audit.localeCompare(right.kode_audit,'id-ID',{numeric:true}));
}

export async function getDaftarKetidaksesuaianReport(kodeAudit:string):Promise<DaftarKetidaksesuaianReport>{
  const kode_audit=kodeAudit.trim();
  if(!kode_audit)throw new Error('No. Audit wajib dipilih.');
  const findings=(await loadEligibleFindings())
    .filter(finding=>finding.kode_audit===kode_audit)
    .sort((left,right)=>left.nomor_urut_temuan-right.nomor_urut_temuan||left.id.localeCompare(right.id));
  if(!findings.length)throw new Error('Finding dengan LTP untuk No. Audit ini tidak ditemukan atau tidak dapat diakses.');

  const instructionRowId=findings[0].instruction_row_id;
  if(findings.some(finding=>finding.instruction_row_id!==instructionRowId)){
    throw new Error('Data Finding pada No. Audit ini tidak konsisten dengan satu baris Instruksi Audit.');
  }
  const context=await getFindingContext(findings[0].id);
  if(context.row.id!==instructionRowId||context.row.kode_audit!==kode_audit){
    throw new Error('Konteks Tim Audit tidak konsisten dengan Finding yang dipilih.');
  }
  const leader=context.team?.members.find(member=>member.is_team_leader);
  return{
    kode_audit,
    generated_at:new Date().toISOString(),
    team_label:context.team?`${context.team.kode_tim} — ${context.team.nama_tim}`:'-',
    team_leader_name:leader?.auditor?.nama?.trim()||'-',
    rows:findings.map(finding=>({
      finding_id:finding.id,
      nomor_urut_temuan:finding.nomor_urut_temuan,
      reference:finding.reference?.trim()||null,
      narrative:formatFindingNarrative(finding),
      location:finding.location?.trim()||null,
      kategori:finding.kategori,
      saran_perbaikan:finding.saran_perbaikan?.trim()||null,
    })),
  };
}
