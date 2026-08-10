// Halaman "Program Internal Audit" — list program + detail view.
// Program dibuat dari Rencana Audit Tahunan yang berstatus Approved.
// Tombol "Buat Program Internal Audit" ada di halaman Rencana Audit Tahunan (Batch 1).

import { useCallback, useEffect, useState } from 'react';
import { FileCheck, ArrowLeft } from 'lucide-react';
import type {
  AuditProgram,
  AuditProgramDistribusi,
  AuditProgramRisiko,
  AuditProgramStep,
  Seksi,
  AuditPlan,
} from '../../lib/types';
import { PROGRAM_STATUS, JENIS_RONDE } from '../../lib/enums';
import type { JenisRonde } from '../../lib/enums';
import { formatTanggal } from '../../lib/utils';
import {
  getAuditPrograms,
  getAuditProgramById,
  saveAuditProgram,
  approveAuditProgram,
  deleteAuditProgram,
  getDistribusiByProgram,
  toggleDistribusi,
  updateDistribusiManager,
  getRisikoByProgram,
  saveRisiko,
  deleteRisiko,
  getStepsByProgram,
  saveStep,
  deleteStep,
  toggleStepPeriode,
  reorderSteps,
} from '../../services/auditProgramService';
import { getSeksiAktif } from '../../services/seksiService';
import { getAuditPlanById } from '../../services/auditPlanService';
import { ProgramHeader } from './audit-program/ProgramHeader';
import { TujuanPoinPerhatian } from './audit-program/TujuanPoinPerhatian';
import { DistribusiTable } from './audit-program/DistribusiTable';
import { RisikoTable } from './audit-program/RisikoTable';
import { StepsTable } from './audit-program/StepsTable';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Button, Card, Badge, EmptyState, LoadingSpinner } from '../ui';

interface ProgramAuditPageProps {
  // Jika ada initialProgramId, langsung buka detail program tersebut
  initialProgramId?: string | null;
  onClearInitial?: () => void;
}

export function ProgramAuditPage({ initialProgramId, onClearInitial }: ProgramAuditPageProps) {
  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [seksiList, setSeksiList] = useState<Seksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail view state
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [program, setProgram] = useState<AuditProgram | null>(null);
  const [sourcePlan, setSourcePlan] = useState<AuditPlan | null>(null);
  const [distribusi, setDistribusi] = useState<AuditProgramDistribusi[]>([]);
  const [risiko, setRisiko] = useState<AuditProgramRisiko[]>([]);
  const [steps, setSteps] = useState<AuditProgramStep[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Confirm dialogs
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AuditProgram | null>(null);

  // --- Load list ---
  const loadPrograms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [progList, seksi] = await Promise.all([getAuditPrograms(), getSeksiAktif()]);
      setPrograms(progList);
      setSeksiList(seksi);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  // --- Handle initialProgramId (dari tombol di Rencana Audit Tahunan) ---
  useEffect(() => {
    if (initialProgramId) {
      setSelectedProgramId(initialProgramId);
      if (onClearInitial) onClearInitial();
    }
  }, [initialProgramId, onClearInitial]);

  // --- Load detail ---
  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const [p, dist, risk, stps] = await Promise.all([
        getAuditProgramById(id),
        getDistribusiByProgram(id),
        getRisikoByProgram(id),
        getStepsByProgram(id),
      ]);
      setProgram(p);
      setDistribusi(dist);
      setRisiko(risk);
      setSteps(stps);
      // Load source plan untuk info
      if (p?.plan_id) {
        const plan = await getAuditPlanById(p.plan_id);
        setSourcePlan(plan);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat detail');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProgramId) {
      loadDetail(selectedProgramId);
    } else {
      setProgram(null);
      setSourcePlan(null);
      setDistribusi([]);
      setRisiko([]);
      setSteps([]);
    }
  }, [selectedProgramId, loadDetail]);

  // --- Handlers ---
  const isReadOnly = program?.status === PROGRAM_STATUS.APPROVED;

  async function handleFieldChange(field: string, value: unknown) {
    if (!program) return;
    const updated = { ...program, [field]: value } as AuditProgram;
    setProgram(updated);
    try {
      await saveAuditProgram(updated);
      setPrograms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    }
  }

  async function handleApprove() {
    if (!program) return;
    setConfirmApprove(false);
    try {
      await approveAuditProgram(program.id);
      await loadDetail(program.id);
      await loadPrograms();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyetujui');
    }
  }

  async function handleDeleteProgram() {
    if (!confirmDelete) return;
    try {
      await deleteAuditProgram(confirmDelete.id);
      setConfirmDelete(null);
      setSelectedProgramId(null);
      await loadPrograms();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus');
    }
  }

  // Distribusi handlers
  async function handleToggleSeksi(seksiId: string, seksi: Seksi) {
    if (!program) return;
    try {
      await toggleDistribusi(program.id, seksiId, seksi);
      const dist = await getDistribusiByProgram(program.id);
      setDistribusi(dist);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal toggle distribusi');
    }
  }

  async function handleUpdateManager(distribusiId: string, nama: string) {
    try {
      await updateDistribusiManager(distribusiId, nama);
      // Update local state langsung untuk responsivitas
      setDistribusi((prev) =>
        prev.map((d) => (d.id === distribusiId ? { ...d, nama_section_manager: nama } : d)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengupdate manager');
    }
  }

  // Risiko handlers
  async function handleAddRisiko() {
    if (!program) return;
    try {
      await saveRisiko({ program_id: program.id });
      const risk = await getRisikoByProgram(program.id);
      setRisiko(risk);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menambah risiko');
    }
  }

  async function handleUpdateRisiko(id: string, field: keyof AuditProgramRisiko, value: string) {
    const existing = risiko.find((r) => r.id === id);
    if (!existing) return;
    try {
      await saveRisiko({ ...existing, [field]: value });
      setRisiko((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengupdate risiko');
    }
  }

  async function handleDeleteRisiko(id: string) {
    try {
      await deleteRisiko(id);
      setRisiko((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus risiko');
    }
  }

  // Steps handlers
  async function handleAddStep() {
    if (!program) return;
    try {
      await saveStep({
        program_id: program.id,
        periode_target: new Array(program.periode_label.length).fill(false),
      });
      const stps = await getStepsByProgram(program.id);
      setSteps(stps);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menambah langkah');
    }
  }

  async function handleUpdateStep(id: string, field: keyof AuditProgramStep, value: string) {
    const existing = steps.find((s) => s.id === id);
    if (!existing) return;
    try {
      await saveStep({ ...existing, [field]: value });
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengupdate langkah');
    }
  }

  async function handleDeleteStep(id: string) {
    try {
      await deleteStep(id);
      setSteps((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus langkah');
    }
  }

  async function handleTogglePeriode(stepId: string, periodeIndex: number, currentValue: boolean[]) {
    try {
      await toggleStepPeriode(stepId, periodeIndex, currentValue);
      setSteps((prev) =>
        prev.map((s) => {
          if (s.id !== stepId) return s;
          const newPeriode = [...(s.periode_target ?? [])];
          newPeriode[periodeIndex] = !newPeriode[periodeIndex];
          return { ...s, periode_target: newPeriode };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal toggle periode');
    }
  }

  async function handleReorderSteps(orderedIds: string[]) {
    if (!program) return;
    try {
      await reorderSteps(program.id, orderedIds);
      const stps = await getStepsByProgram(program.id);
      setSteps(stps);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengurutkan');
    }
  }

  // --- Render ---
  if (loading) return <LoadingSpinner message="Memuat program audit..." />;

  // Detail view
  if (selectedProgramId && program) {
    if (loadingDetail) return <LoadingSpinner message="Memuat detail program..." />;

    return (
      <div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <ProgramHeader
          program={program}
          readOnly={isReadOnly}
          onFieldChange={handleFieldChange}
          onApprove={() => setConfirmApprove(true)}
          onBack={() => setSelectedProgramId(null)}
        />

        {sourcePlan && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <strong>Sumber:</strong> Rencana Audit Tahunan {sourcePlan.tahun} — Rev {sourcePlan.no_revisi} ({sourcePlan.kode_dokumen})
          </div>
        )}

        <TujuanPoinPerhatian program={program} readOnly={isReadOnly} onFieldChange={handleFieldChange} />

        <DistribusiTable
          seksiList={seksiList}
          distribusi={distribusi}
          readOnly={isReadOnly}
          onToggleSeksi={handleToggleSeksi}
          onUpdateManager={handleUpdateManager}
        />

        <RisikoTable
          risiko={risiko}
          readOnly={isReadOnly}
          onAdd={handleAddRisiko}
          onUpdate={handleUpdateRisiko}
          onDelete={handleDeleteRisiko}
        />

        <StepsTable
          steps={steps}
          periodeLabel={program.periode_label}
          readOnly={isReadOnly}
          onTogglePeriode={handleTogglePeriode}
          onUpdateField={handleUpdateStep}
          onAdd={handleAddStep}
          onDelete={handleDeleteStep}
          onReorder={handleReorderSteps}
        />

        <ConfirmDialog
          open={confirmApprove}
          title="Setujui Program Internal Audit"
          message="Setelah disetujui, program menjadi read-only. Pastikan semua data sudah lengkap."
          confirmLabel="Setujui"
          variant="info"
          onConfirm={handleApprove}
          onCancel={() => setConfirmApprove(false)}
        />
      </div>
    );
  }

  // List view
  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Program Internal Audit</h1>
          <p className="mt-1 text-sm text-gray-500">
            Dokumen SOP per ronde audit (berkala/khusus). Dibuat dari Rencana Audit Tahunan yang sudah disetujui.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {programs.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            icon={<FileCheck size={40} />}
            title="Belum ada program audit"
            message="Untuk membuat program audit, buka Rencana Audit Tahunan yang berstatus Approved, lalu klik 'Buat Program Internal Audit'."
          />
        </Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tahun</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Jenis</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nomor Ke</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kode Dokumen</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal Dibuat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {programs.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedProgramId(p.id)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.tahun}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.jenis_ronde}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.nomor_ke}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.kode_dokumen}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatTanggal(p.tanggal_dibuat)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.status === PROGRAM_STATUS.APPROVED ? 'green' : 'amber'}>
                      {p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(p);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Hapus"
                    >
                      <ArrowLeft size={14} className="rotate-45" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus Program Audit"
        message={`Yakin ingin menghapus program audit ${confirmDelete?.jenis_ronde} ke-${confirmDelete?.nomor_ke} tahun ${confirmDelete?.tahun}?`}
        confirmLabel="Hapus"
        onConfirm={handleDeleteProgram}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
