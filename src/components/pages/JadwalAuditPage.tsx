// Halaman "Jadwal Audit" — list sesi audit + detail view dengan tab.
// Tab pertama: "Ruang Lingkup". Tab lainnya menyusul di batch berikutnya.
// Buat jadwal baru via wizard 2-langkah (CreateWizardModal).

import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Plus, ArrowLeft, Trash2 } from 'lucide-react';
import type { AuditSchedule, AuditScope, Proses, Seksi } from '../../lib/types';
import { AUDIT_SCHEDULE_STATUS } from '../../lib/enums';
import type { JenisAudit, StandarAudit } from '../../lib/enums';
import { formatTanggal } from '../../lib/utils';
import {
  getAuditSchedules,
  getAuditScheduleById,
  saveAuditSchedule,
  deleteAuditSchedule,
  getScopesBySchedule,
  createScheduleWithScopes,
  validateScheduledScopes,
} from '../../services/auditScheduleService';
import type { ScopeInput } from '../../services/auditScheduleService';
import { getSeksiAktif } from '../../services/seksiService';
import { getActiveProses } from '../../services/prosesService';
import { CreateWizardModal } from './jadwal-audit/CreateWizardModal';
import { ScheduleHeader } from './jadwal-audit/ScheduleHeader';
import { ScopeTab } from './jadwal-audit/ScopeTab';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Button, Card, Badge, EmptyState, LoadingSpinner } from '../ui';

const STATUS_BADGE: Record<string, 'gray' | 'green' | 'blue' | 'amber'> = {
  Draft: 'amber',
  Scheduled: 'blue',
  'In Progress': 'blue',
  Completed: 'green',
  Closed: 'gray',
};

type TabId = 'ruang-lingkup';

const TABS: { id: TabId; label: string; soon?: boolean }[] = [
  { id: 'ruang-lingkup', label: 'Ruang Lingkup' },
];

export function JadwalAuditPage() {
  // List state
  const [schedules, setSchedules] = useState<AuditSchedule[]>([]);
  const [seksiList, setSeksiList] = useState<Seksi[]>([]);
  const [prosesList, setProsesList] = useState<Proses[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);

  // Detail view state
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<AuditSchedule | null>(null);
  const [scopes, setScopes] = useState<AuditScope[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('ruang-lingkup');
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Confirm dialogs
  const [confirmDelete, setConfirmDelete] = useState<AuditSchedule | null>(null);
  const [confirmSchedule, setConfirmSchedule] = useState(false);

  // --- Load list ---
  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [scheds, seksi, proses] = await Promise.all([
        getAuditSchedules(),
        getSeksiAktif(),
        getActiveProses(),
      ]);
      setSchedules(scheds);
      setSeksiList(seksi);
      setProsesList(proses);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // --- Load detail ---
  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const [sched, sc] = await Promise.all([
        getAuditScheduleById(id),
        getScopesBySchedule(id),
      ]);
      setSchedule(sched);
      setScopes(sc);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat detail');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedScheduleId) {
      loadDetail(selectedScheduleId);
    } else {
      setSchedule(null);
      setScopes([]);
    }
  }, [selectedScheduleId, loadDetail]);

  // --- Handlers ---
  const isReadOnly = schedule?.status === AUDIT_SCHEDULE_STATUS.CLOSED;

  async function handleFieldChange(field: string, value: unknown) {
    if (!schedule) return;
    const updated = { ...schedule, [field]: value } as AuditSchedule;
    setSchedule(updated);
    try {
      await saveAuditSchedule(updated);
      setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    }
  }

  async function handleCreate(data: {
    tahun: number;
    tanggal_mulai: string | null;
    tanggal_selesai: string | null;
    jenis_audit: JenisAudit;
    standar: StandarAudit[];
    scopes: ScopeInput[];
  }) {
    await createScheduleWithScopes(data.tahun, {
      tanggal_mulai: data.tanggal_mulai,
      tanggal_selesai: data.tanggal_selesai,
      jenis_audit: data.jenis_audit,
      standar: data.standar,
      scopes: data.scopes,
    });
    await loadSchedules();
  }

  async function handleSchedule() {
    if (!schedule) return;
    // Validate: must have at least 1 scope with seksi
    const scopeInputs: ScopeInput[] = scopes.map((s) => ({
      area: s.area,
      seksi_terkait: s.seksi_terkait,
      proses_terkait: s.proses_terkait,
      klausul_standar: s.klausul_standar,
      dokumen_referensi: s.dokumen_referensi,
      pic_area: s.pic_area,
    }));
    const validationError = validateScheduledScopes(scopeInputs);
    if (validationError) {
      setError(validationError);
      setConfirmSchedule(false);
      return;
    }
    setConfirmSchedule(false);
    try {
      const updated = { ...schedule, status: AUDIT_SCHEDULE_STATUS.SCHEDULED } as AuditSchedule;
      await saveAuditSchedule(updated);
      setSchedule(updated);
      setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah status ke Scheduled');
    }
  }

  async function handleDeleteSchedule() {
    if (!confirmDelete) return;
    try {
      await deleteAuditSchedule(confirmDelete.id);
      setConfirmDelete(null);
      setSelectedScheduleId(null);
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus');
    }
  }

  function handleReloadScopes() {
    if (selectedScheduleId) loadDetail(selectedScheduleId);
  }

  // --- Render: Loading ---
  if (loading) return <LoadingSpinner message="Memuat jadwal audit..." />;

  // --- Render: Detail view ---
  if (selectedScheduleId && schedule) {
    if (loadingDetail) return <LoadingSpinner message="Memuat detail sesi audit..." />;

    return (
      <div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <ScheduleHeader
          schedule={schedule}
          readOnly={isReadOnly}
          scopeCount={scopes.length}
          onFieldChange={handleFieldChange}
          onSchedule={() => setConfirmSchedule(true)}
          onBack={() => setSelectedScheduleId(null)}
        />

        {/* Tab navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => !tab.soon && setActiveTab(tab.id)}
                disabled={tab.soon}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : tab.soon
                      ? 'border-transparent text-gray-400 cursor-not-allowed'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.soon && (
                  <span className="ml-2 text-xs text-gray-400">(segera)</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === 'ruang-lingkup' && (
          <ScopeTab
            scheduleId={schedule.id}
            scopes={scopes}
            prosesList={prosesList}
            seksiList={seksiList}
            readOnly={isReadOnly}
            onReload={handleReloadScopes}
            onError={(msg) => setError(msg)}
          />
        )}

        <ConfirmDialog
          open={confirmSchedule}
          title="Schedule Jadwal Audit"
          message="Setelah di-schedule, jadwal siap dieksekusi. Pastikan ruang lingkup sudah lengkap."
          confirmLabel="Schedule"
          variant="info"
          onConfirm={handleSchedule}
          onCancel={() => setConfirmSchedule(false)}
        />
      </div>
    );
  }

  // --- Render: List view ---
  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jadwal Audit</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sesi audit teknis per periode. Buat jadwal baru, lalu isi ruang lingkup per area.
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus size={16} /> Buat Jadwal Audit
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {schedules.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            icon={<CalendarCheck size={40} />}
            title="Belum ada jadwal audit"
            message="Klik 'Buat Jadwal Audit' untuk memulai sesi audit baru."
            action={
              <Button onClick={() => setWizardOpen(true)}>
                <Plus size={14} /> Buat Jadwal Audit
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kode Audit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal Mulai</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal Selesai</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Jenis</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Standar</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schedules.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedScheduleId(s.id)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.kode_audit}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatTanggal(s.tanggal_mulai)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatTanggal(s.tanggal_selesai)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.jenis_audit}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {(s.standar ?? []).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[s.status] ?? 'gray'}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(s);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <CreateWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        prosesList={prosesList}
        seksiList={seksiList}
        onCreate={handleCreate}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus Jadwal Audit"
        message={`Yakin ingin menghapus jadwal audit ${confirmDelete?.kode_audit}? Semua ruang lingkup akan ikut terhapus.`}
        confirmLabel="Hapus"
        onConfirm={handleDeleteSchedule}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
