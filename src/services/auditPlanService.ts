// Data access layer untuk Rencana Audit Tahunan.
// Mencakup header plan, proses, matriks seksi link, dan matriks schedule bulanan.
// Operasi massal (salin dari tahun lalu, auto-populate link/schedule) dibungkus
// dalam fungsi yang gagal secara atomic — tidak meninggalkan data tidak konsisten.

import { supabase } from '../lib/supabaseClient';
import type {
  AuditPlan,
  AuditPlanProcess,
  AuditPlanSeksiLink,
  AuditPlanSchedule,
  Seksi,
} from '../lib/types';
import { AUDIT_PLAN_STATUS, PERAN_PROSES } from '../lib/enums';
import type { PeranProses } from '../lib/enums';
import { validateRequired } from '../lib/utils';

// Row mapper: snake_case DB → camelCase interface
function mapPlan(row: Record<string, unknown>): AuditPlan {
  return {
    id: row.id as string,
    tahun: row.tahun as number,
    tanggal_berlaku: row.tanggal_berlaku as string,
    no_revisi: row.no_revisi as number,
    kode_dokumen: row.kode_dokumen as string,
    penanggung_jawab_qms: (row.penanggung_jawab_qms as string) ?? null,
    disetujui_oleh: (row.disetujui_oleh as string) ?? null,
    status: row.status as AuditPlan['status'],
    seksi_terlibat: (row.seksi_terlibat as string[]) ?? [],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapProcess(row: Record<string, unknown>): AuditPlanProcess {
  return {
    id: row.id as string,
    plan_id: row.plan_id as string,
    proses_master_id: (row.proses_master_id as string) ?? null,
    nama_proses: row.nama_proses as string,
    catatan_kaki: (row.catatan_kaki as string) ?? null,
    urutan_tampil: row.urutan_tampil as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ============================================================
// AUDIT PLANS (header)
// ============================================================

export async function getAuditPlans(): Promise<AuditPlan[]> {
  const { data, error } = await supabase
    .from('audit_plans')
    .select('*')
    .order('tahun', { ascending: false })
    .order('no_revisi', { ascending: false });

  if (error) throw new Error(`Gagal memuat rencana audit: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapPlan(r));
}

export async function getAuditPlanById(id: string): Promise<AuditPlan | null> {
  const { data, error } = await supabase
    .from('audit_plans')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat rencana audit: ${error.message}`);
  return data ? mapPlan(data as Record<string, unknown>) : null;
}

export async function getLatestPlanByYear(tahun: number): Promise<AuditPlan | null> {
  const { data, error } = await supabase
    .from('audit_plans')
    .select('*')
    .eq('tahun', tahun)
    .order('no_revisi', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat rencana audit: ${error.message}`);
  return data ? mapPlan(data as Record<string, unknown>) : null;
}

export async function saveAuditPlan(plan: Partial<AuditPlan>): Promise<AuditPlan> {
  validateRequired(
    {
      tahun: plan.tahun,
      tanggal_berlaku: plan.tanggal_berlaku,
      kode_dokumen: plan.kode_dokumen,
    },
    {
      tahun: 'Tahun',
      tanggal_berlaku: 'Tanggal Berlaku',
      kode_dokumen: 'Kode Dokumen',
    },
  );

  const payload = {
    tahun: plan.tahun,
    tanggal_berlaku: plan.tanggal_berlaku,
    no_revisi: plan.no_revisi ?? 0,
    kode_dokumen: plan.kode_dokumen,
    penanggung_jawab_qms: plan.penanggung_jawab_qms ?? null,
    disetujui_oleh: plan.disetujui_oleh ?? null,
    status: plan.status ?? AUDIT_PLAN_STATUS.DRAFT,
    seksi_terlibat: plan.seksi_terlibat ?? [],
  };

  if (plan.id) {
    const { data, error } = await supabase
      .from('audit_plans')
      .update(payload)
      .eq('id', plan.id)
      .select()
      .single();
    if (error) throw new Error(`Gagal mengupdate rencana audit: ${error.message}`);
    return mapPlan(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('audit_plans')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Gagal menambah rencana audit: ${error.message}`);
  return mapPlan(data as Record<string, unknown>);
}

export async function approveAuditPlan(id: string, disetujuiOleh: string): Promise<void> {
  validateRequired({ disetujuiOleh }, { disetujuiOleh: 'Disetujui Oleh' });

  const { error } = await supabase
    .from('audit_plans')
    .update({ status: AUDIT_PLAN_STATUS.APPROVED, disetujui_oleh: disetujuiOleh })
    .eq('id', id);
  if (error) throw new Error(`Gagal menyetujui rencana audit: ${error.message}`);
}

// "Buat Revisi Baru" — menaikkan nomor revisi, plan lama tetap tersimpan sebagai record terpisah.
// Mengembalikan plan baru dengan data dasar yang sama (tahun, kode dokumen, PJ QMS) tapi
// seksi_terlibat dan daftar proses dikosongkan agar user bisa mulai dari template atau salin.
export async function createRevision(oldPlan: AuditPlan): Promise<AuditPlan> {
  const newPlan = await saveAuditPlan({
    tahun: oldPlan.tahun,
    tanggal_berlaku: oldPlan.tanggal_berlaku,
    no_revisi: oldPlan.no_revisi + 1,
    kode_dokumen: oldPlan.kode_dokumen,
    penanggung_jawab_qms: oldPlan.penanggung_jawab_qms,
    status: AUDIT_PLAN_STATUS.DRAFT,
    seksi_terlibat: [], // kosong — user bisa salin dari revisi lama
  });
  return newPlan;
}

export async function deleteAuditPlan(id: string): Promise<void> {
  const { error } = await supabase
    .from('audit_plans')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Gagal menghapus rencana audit: ${error.message}`);
}

// ============================================================
// AUDIT_PLAN_PROCESS (daftar proses per plan)
// ============================================================

export async function getProcessesByPlan(planId: string): Promise<AuditPlanProcess[]> {
  const { data, error } = await supabase
    .from('audit_plan_process')
    .select('*')
    .eq('plan_id', planId)
    .order('urutan_tampil', { ascending: true });

  if (error) throw new Error(`Gagal memuat daftar proses: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapProcess(r));
}

// Sync proses dari master data (tabel `proses`) ke plan ini.
// Hanya proses dengan diaudit_tahun_ini=true yang disalin.
// Idempotent: jika proses_master_id sudah ada di plan, nama/kode di-update (bukan di-insert ulang).
// Gunakan upsert dengan onConflict (plan_id, proses_master_id) untuk mencegah duplikat
// bahkan jika fungsi ini dipanggil bersamaan (race / StrictMode double-invoke).
// Proses lama yang diketik manual (proses_master_id=NULL) tetap dipertahankan.
export async function syncProcessesFromMaster(
  planId: string,
  masterProsesList: { id: string; nama_proses: string; kode_proses: string }[],
): Promise<boolean> {
  // Ambil proses yang sudah ada di plan untuk menentukan urutan berikutnya
  const existing = await getProcessesByPlan(planId);
  const existingMasterIds = new Set(
    existing.filter((p) => p.proses_master_id).map((p) => p.proses_master_id),
  );

  const toUpsert = masterProsesList
    .filter((m) => !existingMasterIds.has(m.id))
    .map((m, idx) => ({
      plan_id: planId,
      proses_master_id: m.id,
      nama_proses: m.nama_proses,
      catatan_kaki: m.kode_proses,
      urutan_tampil: existing.length + idx + 1,
    }));

  if (toUpsert.length === 0) return false;

  // Upsert dengan constraint unik (plan_id, proses_master_id) — mencegah duplikat
  const { error } = await supabase
    .from('audit_plan_process')
    .upsert(toUpsert, { onConflict: 'plan_id,proses_master_id', ignoreDuplicates: true })
    .select();
  if (error) throw new Error(`Gagal sync proses dari master: ${error.message}`);
  return true;
}

export async function saveProcess(proc: Partial<AuditPlanProcess>): Promise<AuditPlanProcess> {
  validateRequired(
    { plan_id: proc.plan_id, nama_proses: proc.nama_proses },
    { plan_id: 'Plan', nama_proses: 'Nama Proses' },
  );

  const payload = {
    plan_id: proc.plan_id,
    proses_master_id: proc.proses_master_id ?? null,
    nama_proses: proc.nama_proses,
    catatan_kaki: proc.catatan_kaki ?? null,
    urutan_tampil: proc.urutan_tampil ?? 0,
  };

  if (proc.id) {
    const { data, error } = await supabase
      .from('audit_plan_process')
      .update(payload)
      .eq('id', proc.id)
      .select()
      .single();
    if (error) throw new Error(`Gagal mengupdate proses: ${error.message}`);
    return mapProcess(data as Record<string, unknown>);
  }

  // Ambil urutan_tampil terbesar + 1 untuk proses baru
  const existing = await getProcessesByPlan(proc.plan_id!);
  const maxOrder = existing.reduce((max, p) => Math.max(max, p.urutan_tampil), 0);
  payload.urutan_tampil = maxOrder + 1;

  const { data, error } = await supabase
    .from('audit_plan_process')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Gagal menambah proses: ${error.message}`);
  return mapProcess(data as Record<string, unknown>);
}

export async function deleteProcess(id: string): Promise<void> {
  const { error } = await supabase
    .from('audit_plan_process')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Gagal menghapus proses: ${error.message}`);
}

// Reorder proses (drag-and-drop) — update urutan_tampil untuk multiple proses sekaligus.
// Atomic: semua update berhasil atau semua gagal (Supabase batch update).
export async function reorderProcesses(
  planId: string,
  orderedIds: string[],
): Promise<void> {
  const updates = orderedIds.map((id, index) => ({
    id,
    plan_id: planId,
    urutan_tampil: index + 1,
  }));

  const { error } = await supabase
    .from('audit_plan_process')
    .upsert(updates, { onConflict: 'id' });

  if (error) throw new Error(`Gagal mengurutkan ulang proses: ${error.message}`);
}

// ============================================================
// AUDIT_PLAN_SEKSI_LINK (matriks proses × seksi)
// ============================================================

export async function getSeksiLinksByPlan(planId: string): Promise<AuditPlanSeksiLink[]> {
  // Join via process_id → plan_id
  const { data, error } = await supabase
    .from('audit_plan_seksi_link')
    .select('*, audit_plan_process!inner(plan_id)')
    .eq('audit_plan_process.plan_id', planId);

  if (error) throw new Error(`Gagal memuat matriks seksi: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    process_id: r.process_id as string,
    seksi_id: r.seksi_id as string,
    terkait: r.terkait as boolean,
    peran: (r.peran as PeranProses | null) ?? null,
    flag_audit_proses_shift_produk: (r.flag_audit_proses_shift_produk as boolean) ?? false,
    flag_lingkup_pdca: (r.flag_lingkup_pdca as boolean) ?? false,
    created_at: r.created_at as string,
  }));
}

// Toggle sel matriks: siklus 3-state untuk peran seksi.
// null → 'utama' (◎) → 'terkait' (O) → null (kosong)
// Seksi utama unik per proses: saat set 'utama', seksi lain yang 'utama' direset ke null.
export async function cycleSeksiPeran(
  processId: string,
  seksiId: string,
  currentPeran: PeranProses | null,
): Promise<void> {
  const nextPeran: PeranProses | null =
    currentPeran === null ? PERAN_PROSES.UTAMA
    : currentPeran === PERAN_PROSES.UTAMA ? PERAN_PROSES.TERKAIT
    : null;

  if (nextPeran === null) {
    // Hapus link (atau set peran=null + terkait=false)
    const { data: existing } = await supabase
      .from('audit_plan_seksi_link')
      .select('id')
      .eq('process_id', processId)
      .eq('seksi_id', seksiId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from('audit_plan_seksi_link')
        .update({ peran: null, terkait: false })
        .eq('id', (existing as { id: string }).id);
      if (error) throw new Error(`Gagal update peran: ${error.message}`);
    }
    return;
  }

  // Jika set 'utama', reset seksi utama lain di proses ini ke null
  if (nextPeran === PERAN_PROSES.UTAMA) {
    const { data: utamaLain } = await supabase
      .from('audit_plan_seksi_link')
      .select('id')
      .eq('process_id', processId)
      .eq('peran', PERAN_PROSES.UTAMA)
      .neq('seksi_id', seksiId);
    if (utamaLain && (utamaLain as { id: string }[]).length > 0) {
      const ids = (utamaLain as { id: string }[]).map((r) => r.id);
      await supabase
        .from('audit_plan_seksi_link')
        .update({ peran: null, terkait: false })
        .in('id', ids);
    }
  }

  // Upsert link untuk seksi ini
  const { data: existing } = await supabase
    .from('audit_plan_seksi_link')
    .select('id')
    .eq('process_id', processId)
    .eq('seksi_id', seksiId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('audit_plan_seksi_link')
      .update({ peran: nextPeran, terkait: nextPeran !== null })
      .eq('id', (existing as { id: string }).id);
    if (error) throw new Error(`Gagal update peran: ${error.message}`);
  } else {
    const { error } = await supabase
      .from('audit_plan_seksi_link')
      .insert({
        process_id: processId,
        seksi_id: seksiId,
        peran: nextPeran,
        terkait: nextPeran !== null,
      });
    if (error) throw new Error(`Gagal membuat link seksi: ${error.message}`);
  }
}

// Toggle flag *1 atau *2 pada sel matriks proses × seksi.
// field: 'flag_audit_proses_shift_produk' (*1) atau 'flag_lingkup_pdca' (*2)
export async function toggleSeksiFlag(
  processId: string,
  seksiId: string,
  field: 'flag_audit_proses_shift_produk' | 'flag_lingkup_pdca',
): Promise<void> {
  const { data: existing } = await supabase
    .from('audit_plan_seksi_link')
    .select('id, peran, flag_audit_proses_shift_produk, flag_lingkup_pdca')
    .eq('process_id', processId)
    .eq('seksi_id', seksiId)
    .maybeSingle();

  if (existing) {
    const row = existing as {
      id: string;
      peran: PeranProses | null;
      flag_audit_proses_shift_produk: boolean;
      flag_lingkup_pdca: boolean;
    };
    const newValue = !row[field];
    const { error } = await supabase
      .from('audit_plan_seksi_link')
      .update({ [field]: newValue })
      .eq('id', row.id);
    if (error) throw new Error(`Gagal mengubah flag: ${error.message}`);
  } else {
    // Buat link baru dengan peran=null dan flag yang ditoggle = true
    const payload = {
      process_id: processId,
      seksi_id: seksiId,
      peran: null,
      terkait: false,
      flag_audit_proses_shift_produk: field === 'flag_audit_proses_shift_produk',
      flag_lingkup_pdca: field === 'flag_lingkup_pdca',
    };
    const { error } = await supabase.from('audit_plan_seksi_link').insert(payload);
    if (error) throw new Error(`Gagal membuat link flag: ${error.message}`);
  }
}

// Auto-populate: pastikan semua sel matriks proses × seksi_terlibat ada (terkait=false default).
// Dipanggil saat seksi_terlibat atau daftar proses berubah.
export async function ensureSeksiLinks(
  processIds: string[],
  seksiIds: string[],
): Promise<void> {
  if (processIds.length === 0 || seksiIds.length === 0) return;

  // Ambil link yang sudah ada
  const { data: existing } = await supabase
    .from('audit_plan_seksi_link')
    .select('process_id, seksi_id')
    .in('process_id', processIds)
    .in('seksi_id', seksiIds);

  const existingSet = new Set(
    (existing ?? []).map((r: Record<string, unknown>) => `${r.process_id}|${r.seksi_id}`),
  );

  // Buat link yang belum ada (terkait=false, peran=null)
  const toInsert: { process_id: string; seksi_id: string; terkait: boolean; peran: null }[] = [];
  for (const pId of processIds) {
    for (const sId of seksiIds) {
      if (!existingSet.has(`${pId}|${sId}`)) {
        toInsert.push({ process_id: pId, seksi_id: sId, terkait: false, peran: null });
      }
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('audit_plan_seksi_link').insert(toInsert);
    if (error) throw new Error(`Gagal auto-populate matriks seksi: ${error.message}`);
  }
}

// ============================================================
// AUDIT_PLAN_SCHEDULE (matriks proses × bulan)
// ============================================================

export async function getSchedulesByPlan(planId: string): Promise<AuditPlanSchedule[]> {
  const { data, error } = await supabase
    .from('audit_plan_schedule')
    .select('*, audit_plan_process!inner(plan_id)')
    .eq('audit_plan_process.plan_id', planId);

  if (error) throw new Error(`Gagal memuat jadwal: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    process_id: r.process_id as string,
    bulan: r.bulan as number,
    plan: r.plan as boolean,
    aktual: r.aktual as boolean,
    schedule_id: (r.schedule_id as string) ?? null,
    created_at: r.created_at as string,
  }));
}

// Toggle sel schedule (plan atau aktual) untuk bulan tertentu.
// Jika belum ada row, buat baru dengan flag yang ditoggle = true.
export async function toggleSchedule(
  processId: string,
  bulan: number,
  field: 'plan' | 'aktual',
): Promise<void> {
  const { data: existing } = await supabase
    .from('audit_plan_schedule')
    .select('*')
    .eq('process_id', processId)
    .eq('bulan', bulan)
    .maybeSingle();

  if (existing) {
    const newValue = !existing[field];
    const { error } = await supabase
      .from('audit_plan_schedule')
      .update({ [field]: newValue })
      .eq('id', existing.id);
    if (error) throw new Error(`Gagal toggle jadwal: ${error.message}`);
  } else {
    const newRow = {
      process_id: processId,
      bulan,
      plan: field === 'plan' ? true : false,
      aktual: field === 'aktual' ? true : false,
    };
    const { error } = await supabase.from('audit_plan_schedule').insert(newRow);
    if (error) throw new Error(`Gagal membuat jadwal: ${error.message}`);
  }
}

// Auto-populate: pastikan semua sel proses × 12 bulan ada (semua false default).
export async function ensureSchedules(processIds: string[]): Promise<void> {
  if (processIds.length === 0) return;

  const { data: existing } = await supabase
    .from('audit_plan_schedule')
    .select('process_id, bulan')
    .in('process_id', processIds);

  const existingSet = new Set(
    (existing ?? []).map(
      (r: Record<string, unknown>) => `${r.process_id}|${r.bulan}`,
    ),
  );

  const toInsert: { process_id: string; bulan: number; plan: boolean; aktual: boolean }[] = [];
  for (const pId of processIds) {
    for (let bulan = 1; bulan <= 12; bulan++) {
      if (!existingSet.has(`${pId}|${bulan}`)) {
        toInsert.push({ process_id: pId, bulan, plan: false, aktual: false });
      }
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('audit_plan_schedule').insert(toInsert);
    if (error) throw new Error(`Gagal auto-populate jadwal: ${error.message}`);
  }
}

// ============================================================
// "SALIN DARI TAHUN LALU" — operasi massal atomic
// Menyalin seksi_terlibat dan daftar proses dari plan tahun sebelumnya
// sebagai starting point yang bisa diedit.
// ============================================================

export async function copyFromPreviousYear(
  newPlanId: string,
  previousPlan: AuditPlan,
): Promise<void> {
  // 1. Salin seksi_terlibat ke plan baru
  const { error: updateErr } = await supabase
    .from('audit_plans')
    .update({ seksi_terlibat: previousPlan.seksi_terlibat })
    .eq('id', newPlanId);
  if (updateErr) throw new Error(`Gagal menyalin seksi terlibat: ${updateErr.message}`);

  // 2. Ambil proses dari plan lama
  const oldProcesses = await getProcessesByPlan(previousPlan.id);
  if (oldProcesses.length === 0) return;

  // 3. Salin proses ke plan baru (urutan tetap, ID baru, pertahankan proses_master_id)
  const newProcesses = oldProcesses.map((p, index) => ({
    plan_id: newPlanId,
    proses_master_id: p.proses_master_id,
    nama_proses: p.nama_proses,
    catatan_kaki: p.catatan_kaki,
    urutan_tampil: index + 1,
  }));

  const { data: insertedProcesses, error: procErr } = await supabase
    .from('audit_plan_process')
    .insert(newProcesses)
    .select('id');
  if (procErr) throw new Error(`Gagal menyalin proses: ${procErr.message}`);

  // 4. Auto-populate matriks seksi link dan schedule untuk proses baru
  const newProcessIds = (insertedProcesses ?? []).map((r: Record<string, unknown>) => r.id as string);
  await ensureSeksiLinks(newProcessIds, previousPlan.seksi_terlibat);
  await ensureSchedules(newProcessIds);
}

// Cari plan tahun sebelumnya (revisi terbesar dari tahun sebelumnya)
export async function findPreviousYearPlan(tahun: number): Promise<AuditPlan | null> {
  const { data, error } = await supabase
    .from('audit_plans')
    .select('*')
    .lt('tahun', tahun)
    .order('tahun', { ascending: false })
    .order('no_revisi', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Gagal mencari plan tahun lalu: ${error.message}`);
  return data ? mapPlan(data as Record<string, unknown>) : null;
}
