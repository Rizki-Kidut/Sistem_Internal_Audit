import { supabase } from '../lib/supabaseClient';
import { computeStatusProgress, type AuditExecutionCounter, type AuditExecutionSummary, type Finding } from '../lib/types';
import { isFindingPLORComplete } from '../lib/finding';
import { getAllInstructionRows } from './auditInstructionService';
import { getAllProses } from './prosesService';
import { getAuditTeamMasters } from './auditTeamMasterService';
import { getChecklistsByRow, getItemsByChecklist } from './checklistService';
import { getProductChecklistsByRow, getProductItemsByPhase, getProductPhases } from './checklistProdukService';
import { getManufacturingChecklistsByRow, getManufacturingItems } from './checklistManufakturService';

const emptyCounter = (): AuditExecutionCounter => ({ O: 0, A: 0, B: 0, C: 0, evaluated: 0, total: 0 });

async function sourceState(row: AuditExecutionSummary['row']) {
  const counter = emptyCounter();
  if (row.tipe_baris === 'Reguler') {
    const lists = await getChecklistsByRow(row.id);
    const items = (await Promise.all(lists.map(list => getItemsByChecklist(list.id)))).flat();
    counter.total = items.length;
    items.forEach(item => { if (!item.hasil || !item.komentar_auditor?.trim()) return; counter.evaluated++; if (item.hasil !== 'N-A' && item.hasil in counter) counter[item.hasil as 'O'|'A'|'B'|'C']++; });
    return { counter, exists: lists.length > 0, complete: items.length > 0 && items.every(item => Boolean(item.hasil && item.komentar_auditor?.trim())) };
  }
  if (row.tipe_baris === 'AuditProduk') {
    const lists = await getProductChecklistsByRow(row.id);
    const phases = (await Promise.all(lists.map(list => getProductPhases(list.id)))).flat();
    const items = (await Promise.all(phases.map(phase => getProductItemsByPhase(phase.id)))).flat();
    counter.total = items.length;
    items.forEach(item => { if (!item.judgment || !item.hasil_pemeriksaan?.trim()) return; counter.evaluated++; if (item.judgment === 'OK') counter.O++; else if (item.finding_kategori) counter[item.finding_kategori]++; });
    return { counter, exists: lists.length > 0, complete: lists.length > 0 && lists.every(list => list.status === 'Selesai') && items.length > 0 && items.every(item => Boolean(item.judgment && item.hasil_pemeriksaan?.trim())) };
  }
  const lists = await getManufacturingChecklistsByRow(row.id);
  const items = (await Promise.all(lists.map(list => getManufacturingItems(list.id)))).flat();
  counter.total = items.length;
  items.forEach(item => { if (item.hasil && item.hasil_pengamatan?.trim()) { counter.evaluated++; if (item.hasil !== 'N-A') counter[item.hasil]++; } });
  return { counter, exists: lists.length > 0, complete: lists.length > 0 && lists.every(list => list.status === 'Selesai') && items.length > 0 && items.every(item => Boolean(item.hasil && item.hasil_pengamatan?.trim())) };
}

export async function listAuditExecutions(): Promise<AuditExecutionSummary[]> {
  const [rows, proses, teams, findingResult, dispositionResult] = await Promise.all([
    getAllInstructionRows(), getAllProses(), getAuditTeamMasters(),
    supabase.from('findings').select('*'),
    supabase.from('finding_source_dispositions').select('*'),
  ]);
  if (findingResult.error) throw new Error(`Gagal memuat status PLOR: ${findingResult.error.message}`);
  if (dispositionResult.error) throw new Error(`Gagal memuat disposisi review: ${dispositionResult.error.message}`);
  const findings = (findingResult.data ?? []) as Finding[];
  const dispositions = dispositionResult.data ?? [];
  return Promise.all(rows.map(async row => {
    const state = await sourceState(row);
    const rowFindings = findings.filter(finding => finding.instruction_row_id === row.id);
    const summary: AuditExecutionSummary = {
      row, proses: proses.find(item => item.id === row.proses_id) ?? null,
      team: teams.find(item => item.id === row.team_master_id) ?? null,
      counter: state.counter, checklist_exists: state.exists, checklist_complete: state.complete,
      status_progress: 'Belum Mulai', findings: rowFindings.map(finding => ({
        id: finding.id, source_item_id: finding.source_item_id, kode_temuan: finding.kode_temuan, draft_reference: finding.draft_reference,
        kategori: finding.kategori, plor_complete: isFindingPLORComplete(finding),
        disposition: dispositions.find(item => item.finding_id === finding.id) ?? null,
      })),
    };
    summary.status_progress = computeStatusProgress(summary);
    return summary;
  }));
}

export async function completeAuditExecution(rowId: string): Promise<void> {
  const { error } = await supabase.rpc('complete_audit_execution', { p_row_id: rowId });
  if (error) throw new Error(error.message);
}

export async function reopenAuditExecution(rowId: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_audit_execution', { p_row_id: rowId });
  if (error) throw new Error(error.message);
}
