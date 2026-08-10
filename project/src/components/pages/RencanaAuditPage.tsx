// Halaman "Rencana Audit Tahunan" — matriks proses × seksi × bulan dengan header approval.
// Status Approved → seluruh matriks read-only kecuali tombol "Buat Revisi Baru".
// "Salin dari Tahun Lalu" saat membuat plan baru — menyalin seksi & proses sebagai starting point.

import { useEffect, useState, useCallback } from 'react';
import { Plus, Copy, Save, FileText, FileCheck } from 'lucide-react';
import type { AuditPlan, AuditPlanProcess, AuditPlanSeksiLink, AuditPlanSchedule, Seksi, Proses } from '../../lib/types';
import { AUDIT_PLAN_STATUS, PERAN_PROSES } from '../../lib/enums';
import type { PeranProses } from '../../lib/enums';
import {
  getAuditPlans,
  getAuditPlanById,
  saveAuditPlan,
  approveAuditPlan,
  createRevision,
  deleteAuditPlan,
  getProcessesByPlan,
  deleteProcess,
  reorderProcesses,
  getSeksiLinksByPlan,
  cycleSeksiPeran,
  toggleSeksiFlag,
  ensureSeksiLinks,
  getSchedulesByPlan,
  toggleSchedule,
  ensureSchedules,
  copyFromPreviousYear,
  findPreviousYearPlan,
  syncProcessesFromMaster,
} from '../../services/auditPlanService';
import { getSeksiAktif } from '../../services/seksiService';
import { getActiveProses } from '../../services/prosesService';
import { createProgramFromPlan, getNextNomorKe } from '../../services/auditProgramService';
import { JENIS_RONDE } from '../../lib/enums';
import type { JenisRonde } from '../../lib/enums';
import { PlanHeader } from './audit-plan/PlanHeader';
import { AuditMatrix } from './audit-plan/AuditMatrix';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Field, Input, Select } from '../ui/Field';
import { Button, Card, Badge, EmptyState, LoadingSpinner } from '../ui';

interface RencanaAuditPageProps {
  onNavigateToProgram?: (programId: string) => void;
}

export function RencanaAuditPage({ onNavigateToProgram }: RencanaAuditPageProps = {}) {
  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [seksiAktif, setSeksiAktif] = useState<Seksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Plan yang sedang dipilih/diedit
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [plan, setPlan] = useState<AuditPlan | null>(null);
  const [processes, setProcesses] = useState<AuditPlanProcess[]>([]);
  const [seksiLinks, setSeksiLinks] = useState<AuditPlanSeksiLink[]>([]);
  const [schedules, setSchedules] = useState<AuditPlanSchedule[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal: buat plan baru
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ tahun: new Date().getFullYear(), tanggal_berlaku: '', kode_dokumen: '' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [previousPlanAvailable, setPreviousPlanAvailable] = useState<AuditPlan | null>(null);

  // Modal: approve
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [approveError, setApproveError] = useState<string | null>(null);

  // Modal: pilih seksi terlibat
  const [seksiModalOpen, setSeksiModalOpen] = useState(false);
  const [selectedSeksiIds, setSelectedSeksiIds] = useState<string[]>([]);

  // Master proses map (untuk flag *1, *2 di matriks)
  const [masterProsesMap, setMasterProsesMap] = useState<Map<string, Proses>>(new Map());

  // Confirm: hapus proses
  const [confirmDeleteProcess, setConfirmDeleteProcess] = useState<string | null>(null);

  // Confirm: buat revisi
  const [confirmRevise, setConfirmRevise] = useState(false);

  // Modal: buat program audit
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [programForm, setProgramForm] = useState<{ jenisRonde: JenisRonde; nomorKe: number }>({
    jenisRonde: JENIS_RONDE.BERKALA,
    nomorKe: 1,
  });
  const [programError, setProgramError] = useState<string | null>(null);
  const [creatingProgram, setCreatingProgram] = useState(false);

  // --- Load initial data ---
  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planList, seksiList, masterProses] = await Promise.all([getAuditPlans(), getSeksiAktif(), getActiveProses()]);
      setPlans(planList);
      setSeksiAktif(seksiList);
      // Build master proses map
      const map = new Map<string, Proses>();
      masterProses.forEach((p) => map.set(p.id, p));
      setMasterProsesMap(map);
      if (planList.length > 0 && !selectedPlanId) {
        setSelectedPlanId(planList[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // --- Load detail plan (proses, link, schedule) + sync dari master ---
  const loadDetail = useCallback(async (planId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      // Sync proses aktif dari master data sebelum load
      const masterList = Array.from(masterProsesMap.values()).map((p) => ({
        id: p.id,
        nama_proses: p.nama_proses,
        kode_proses: p.kode_proses,
      }));
      await syncProcessesFromMaster(planId, masterList);

      const [p, procs, links, scheds] = await Promise.all([
        getAuditPlanById(planId),
        getProcessesByPlan(planId),
        getSeksiLinksByPlan(planId),
        getSchedulesByPlan(planId),
      ]);
      setPlan(p);
      setProcesses(procs);
      setSeksiLinks(links);
      setSchedules(scheds);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat detail');
    } finally {
      setLoadingDetail(false);
    }
  }, [masterProsesMap]);

  useEffect(() => {
    if (selectedPlanId) {
      loadDetail(selectedPlanId);
    } else {
      setPlan(null);
      setProcesses([]);
      setSeksiLinks([]);
      setSchedules([]);
    }
  }, [selectedPlanId, loadDetail]);

  // --- Handlers ---

  const isReadOnly = plan?.status === AUDIT_PLAN_STATUS.APPROVED;

  async function handleFieldChange(field: string, value: unknown) {
    if (!plan) return;
    const updated = { ...plan, [field]: value } as AuditPlan;
    setPlan(updated);
    // Auto-save header (debounce sederhana via timeout tidak diterapkan — save langsung)
    try {
      await saveAuditPlan(updated);
      setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    }
  }

  async function handleOpenCreate() {
    setCreateForm({
      tahun: new Date().getFullYear(),
      tanggal_berlaku: '',
      kode_dokumen: '',
    });
    setCreateError(null);
    // Cek apakah ada plan tahun sebelumnya untuk opsi "salin"
    try {
      const prev = await findPreviousYearPlan(new Date().getFullYear());
      setPreviousPlanAvailable(prev);
    } catch {
      setPreviousPlanAvailable(null);
    }
    setCreateModalOpen(true);
  }

  async function handleCreate(copyPrevious: boolean) {
    setCreateError(null);
    setCreating(true);
    try {
      if (!createForm.tanggal_berlaku) throw new Error('Tanggal berlaku wajib diisi');
      if (!createForm.kode_dokumen.trim()) throw new Error('Kode dokumen wajib diisi');

      const newPlan = await saveAuditPlan({
        tahun: createForm.tahun,
        tanggal_berlaku: createForm.tanggal_berlaku,
        kode_dokumen: createForm.kode_dokumen.trim(),
        no_revisi: 0,
        status: AUDIT_PLAN_STATUS.DRAFT,
        seksi_terlibat: [],
      });

      if (copyPrevious && previousPlanAvailable) {
        await copyFromPreviousYear(newPlan.id, previousPlanAvailable);
      }

      setCreateModalOpen(false);
      await loadPlans();
      setSelectedPlanId(newPlan.id);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Gagal membuat rencana');
    } finally {
      setCreating(false);
    }
  }

  async function handleApprove() {
    if (!plan) return;
    setApproveError(null);
    if (!approverName.trim()) {
      setApproveError('Nama approver wajib diisi');
      return;
    }
    try {
      await approveAuditPlan(plan.id, approverName.trim());
      setApproveModalOpen(false);
      setApproverName('');
      await loadPlans();
      await loadDetail(plan.id);
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : 'Gagal menyetujui');
    }
  }

  async function handleOpenCreateProgram() {
    if (!plan) return;
    setProgramError(null);
    try {
      const next = await getNextNomorKe(plan.id, JENIS_RONDE.BERKALA);
      setProgramForm({ jenisRonde: JENIS_RONDE.BERKALA, nomorKe: next });
    } catch {
      setProgramForm({ jenisRonde: JENIS_RONDE.BERKALA, nomorKe: 1 });
    }
    setProgramModalOpen(true);
  }

  async function handleCreateProgram() {
    if (!plan) return;
    setProgramError(null);
    setCreatingProgram(true);
    try {
      const newProgram = await createProgramFromPlan(
        plan,
        programForm.jenisRonde,
        programForm.nomorKe,
        seksiAktif,
      );
      setProgramModalOpen(false);
      if (onNavigateToProgram) onNavigateToProgram(newProgram.id);
    } catch (e) {
      setProgramError(e instanceof Error ? e.message : 'Gagal membuat program audit');
    } finally {
      setCreatingProgram(false);
    }
  }

  async function handleRevise() {
    if (!plan) return;
    setConfirmRevise(false);
    try {
      const newPlan = await createRevision(plan);
      await loadPlans();
      setSelectedPlanId(newPlan.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat revisi');
    }
  }

  async function handleCycleSeksi(processId: string, seksiId: string, currentPeran: PeranProses | null) {
    if (!plan) return;
    try {
      await cycleSeksiPeran(processId, seksiId, currentPeran);
      await loadDetail(plan.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah peran seksi');
    }
  }

  async function handleDeleteProcess() {
    if (!confirmDeleteProcess || !plan) return;
    try {
      await deleteProcess(confirmDeleteProcess);
      setConfirmDeleteProcess(null);
      await loadDetail(plan.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus proses');
    }
  }

  async function handleToggleSeksi(processId: string, seksiId: string, currentPeran: PeranProses | null) {
    if (!plan) return;
    try {
      await cycleSeksiPeran(processId, seksiId, currentPeran);
      await loadDetail(plan.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal toggle seksi');
    }
  }

  async function handleToggleFlag(
    processId: string,
    seksiId: string,
    flag: 'flag_audit_proses_shift_produk' | 'flag_lingkup_pdca',
  ) {
    if (!plan) return;
    try {
      await toggleSeksiFlag(processId, seksiId, flag);
      await loadDetail(plan.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah tanda audit');
    }
  }

  async function handleToggleSchedule(processId: string, bulan: number, field: 'plan' | 'aktual') {
    if (!plan) return;
    try {
      await toggleSchedule(processId, bulan, field);
      await loadDetail(plan.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal toggle jadwal');
    }
  }

  async function handleReorder(orderedIds: string[]) {
    if (!plan) return;
    try {
      await reorderProcesses(plan.id, orderedIds);
      await loadDetail(plan.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengurutkan');
    }
  }

  // --- Seksi terlibat management ---
  async function openSeksiModal() {
    if (!plan) return;
    setSelectedSeksiIds(plan.seksi_terlibat);
    setSeksiModalOpen(true);
  }

  async function handleSaveSeksiTerlibat() {
    if (!plan) return;
    try {
      const updated = { ...plan, seksi_terlibat: selectedSeksiIds };
      await saveAuditPlan(updated);
      // Auto-populate matriks link untuk seksi & proses yang ada
      await ensureSeksiLinks(processes.map((p) => p.id), selectedSeksiIds);
      setSeksiModalOpen(false);
      await loadPlans();
      await loadDetail(plan.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan seksi terlibat');
    }
  }

  // --- Render ---
  if (loading) return <LoadingSpinner message="Memuat rencana audit..." />;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rencana Audit Tahunan</h1>
          <p className="mt-1 text-sm text-gray-500">
            Matriks proses × seksi × bulan dengan header approval.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleOpenCreate}>
            <Plus size={16} /> Rencana Baru
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Daftar plan (tabs) */}
      {plans.length > 0 && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlanId(p.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                selectedPlanId === p.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              {p.tahun} — Rev {p.no_revisi}
              <span className={`ml-2 ${selectedPlanId === p.id ? 'text-blue-200' : ''}`}>
                {p.status === AUDIT_PLAN_STATUS.APPROVED ? '✓' : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {plans.length === 0 && !loading && (
        <Card className="p-12">
          <EmptyState
            icon={<FileText size={40} />}
            title="Belum ada rencana audit"
            message="Buat rencana audit tahunan pertama untuk mulai mengisi matriks proses × seksi × bulan."
            action={
              <Button onClick={handleOpenCreate}>
                <Plus size={16} /> Buat Rencana Baru
              </Button>
            }
          />
        </Card>
      )}

      {/* Detail plan */}
      {plan && (
        <>
          {loadingDetail ? (
            <LoadingSpinner />
          ) : (
            <>
              <PlanHeader
                plan={plan}
                readOnly={isReadOnly}
                onFieldChange={handleFieldChange}
                onApprove={() => setApproveModalOpen(true)}
                onRevise={() => setConfirmRevise(true)}
              />

              {/* Tombol Buat Program Internal Audit — hanya saat Approved */}
              {isReadOnly && (
                <div className="mb-4">
                  <Button onClick={handleOpenCreateProgram}>
                    <FileCheck size={16} /> Buat Program Internal Audit
                  </Button>
                </div>
              )}

              {/* Toolbar matriks */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">Matriks Audit</h2>
                  <Badge variant="blue">{processes.length} proses</Badge>
                  <Badge variant="gray">{plan.seksi_terlibat.length} seksi</Badge>
                </div>
                {!isReadOnly && (
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={openSeksiModal}>
                      Pilih Seksi
                    </Button>
                  </div>
                )}
              </div>

              {plan.seksi_terlibat.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-sm text-gray-500 mb-3">
                    Belum ada seksi terlibat. Pilih seksi yang akan diaudit di rencana ini.
                  </p>
                  {!isReadOnly && (
                    <Button variant="secondary" size="sm" onClick={openSeksiModal}>
                      Pilih Seksi
                    </Button>
                  )}
                </Card>
              ) : (
                <AuditMatrix
                  processes={processes}
                  seksiList={seksiAktif.filter((s) => plan.seksi_terlibat.includes(s.id))}
                  seksiLinks={seksiLinks}
                  schedules={schedules}
                  readOnly={isReadOnly}
                  onCycleSeksi={handleCycleSeksi}
                  onToggleFlag={handleToggleFlag}
                  onToggleSchedule={handleToggleSchedule}
                  onReorder={handleReorder}
                  onDeleteProcess={(id) => setConfirmDeleteProcess(id)}
                />
              )}

              {/* Legenda */}
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Keterangan:</span>
                <span className="flex items-center gap-1">
                  <span className="text-base text-blue-700 font-bold">◎</span> Seksi utama (pemilik proses)
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-base text-blue-600 font-bold">O</span> Seksi terkait
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-amber-600 font-semibold">*1</span> Termasuk audit proses, audit shift, dan audit produk
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-amber-600 font-semibold">*2</span> Lingkup audit: konfirmasi PDCA terkait kontrol kebijakan
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-blue-500"></span> Plan
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-500"></span> Aktual
                </span>
              </div>
            </>
          )}
        </>
      )}

      {/* Modal: Buat rencana baru */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Buat Rencana Audit Baru"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>Batal</Button>
            {previousPlanAvailable && (
              <Button variant="secondary" onClick={() => handleCreate(true)} disabled={creating}>
                <Copy size={16} /> {creating ? 'Memproses...' : 'Salin dari Tahun Lalu'}
              </Button>
            )}
            <Button onClick={() => handleCreate(false)} disabled={creating}>
              {creating ? 'Memproses...' : 'Buat Kosong'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {createError}
            </div>
          )}
          <Field label="Tahun" required>
            <Input
              type="number"
              value={createForm.tahun}
              onChange={(e) => setCreateForm({ ...createForm, tahun: parseInt(e.target.value) || new Date().getFullYear() })}
            />
          </Field>
          <Field label="Tanggal Berlaku" required>
            <Input
              type="date"
              value={createForm.tanggal_berlaku}
              onChange={(e) => setCreateForm({ ...createForm, tanggal_berlaku: e.target.value })}
            />
          </Field>
          <Field label="Kode Dokumen" required>
            <Input
              value={createForm.kode_dokumen}
              onChange={(e) => setCreateForm({ ...createForm, kode_dokumen: e.target.value })}
              placeholder="mis. F-QA-001"
            />
          </Field>
          {previousPlanAvailable && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <div className="flex items-center gap-2 mb-1">
                <Copy size={14} />
                <span className="font-medium">Salin dari Tahun Lalu</span>
              </div>
              <p className="text-xs">
                Ditemukan rencana tahun {previousPlanAvailable.tahun} (Rev {previousPlanAvailable.no_revisi}).
                Klik "Salin dari Tahun Lalu" untuk menyalin daftar seksi & proses sebagai starting point.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Approve */}
      <Modal
        open={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        title="Setujui Rencana Audit"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproveModalOpen(false)}>Batal</Button>
            <Button onClick={handleApprove}>
              <Save size={16} /> Setujui
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {approveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {approveError}
            </div>
          )}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            Setelah disetujui, matriks menjadi read-only. Untuk mengubah, buat revisi baru.
          </div>
          <Field label="Disetujui Oleh" required>
            <Input
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              placeholder="Nama approver"
              autoFocus
            />
          </Field>
        </div>
      </Modal>

      {/* Modal: Pilih seksi terlibat */}
      <Modal
        open={seksiModalOpen}
        onClose={() => setSeksiModalOpen(false)}
        title="Pilih Seksi Terlibat"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSeksiModalOpen(false)}>Batal</Button>
            <Button onClick={handleSaveSeksiTerlibat}>Simpan</Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-gray-500 mb-3">
            Pilih seksi yang akan diaudit di rencana ini. Kolom seksi akan muncul di matriks.
          </p>
          {seksiAktif.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              Belum ada seksi aktif. Tambahkan seksi di menu "Kelola Seksi" terlebih dahulu.
            </p>
          ) : (
            seksiAktif.map((s) => {
              const checked = selectedSeksiIds.includes(s.id);
              return (
                <label
                  key={s.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedSeksiIds((prev) =>
                        checked ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                      );
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{s.nama}</div>
                    {s.kepala_seksi && (
                      <div className="text-xs text-gray-500">Kepala: {s.kepala_seksi}</div>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>
      </Modal>

      {/* Confirm: hapus proses */}
      <ConfirmDialog
        open={!!confirmDeleteProcess}
        title="Hapus Proses"
        message="Yakin ingin menghapus proses ini? Data matriks terkait juga akan dihapus."
        confirmLabel="Hapus"
        onConfirm={handleDeleteProcess}
        onCancel={() => setConfirmDeleteProcess(null)}
      />

      {/* Confirm: buat revisi */}
      <ConfirmDialog
        open={confirmRevise}
        title="Buat Revisi Baru"
        message="Revisi baru akan dibuat dengan nomor revisi bertambah. Rencana lama tetap tersimpan sebagai record terpisah."
        confirmLabel="Buat Revisi"
        variant="info"
        onConfirm={handleRevise}
        onCancel={() => setConfirmRevise(false)}
      />

      {/* Modal: Buat Program Internal Audit */}
      <Modal
        open={programModalOpen}
        onClose={() => setProgramModalOpen(false)}
        title="Buat Program Internal Audit"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setProgramModalOpen(false)}>Batal</Button>
            <Button onClick={handleCreateProgram} disabled={creatingProgram}>
              {creatingProgram ? 'Memproses...' : 'Buat Program'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {programError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {programError}
            </div>
          )}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            Program akan dibuat dari Rencana Audit Tahunan {plan?.tahun} (Rev {plan?.no_revisi}).
            7 langkah baku akan otomatis disalin, dan seksi terlibat akan auto-populate distribusi.
          </div>
          <Field label="Jenis Ronde" required>
            <Select
              value={programForm.jenisRonde}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setProgramForm({ ...programForm, jenisRonde: e.target.value as JenisRonde })
              }
            >
              <option value="Berkala">Berkala</option>
              <option value="Khusus">Khusus</option>
            </Select>
          </Field>
          <Field label="Nomor Ke" required>
            <Input
              type="number"
              value={programForm.nomorKe}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setProgramForm({ ...programForm, nomorKe: parseInt(e.target.value) || 1 })
              }
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
