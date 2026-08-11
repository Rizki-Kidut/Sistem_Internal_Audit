// Tab "Tim Audit" untuk Detail Sesi Audit.
// Pilih Lead Auditor + Members dari data auditor Training.
// Validasi otomatis:
// - Auditor tidak kompeten/expired → disable + badge merah "Tidak memenuhi syarat"
// - Auditor dari departemen yang sama dengan area yang diaudit → badge kuning
//   "Berpotensi konflik independensi", tetap bisa pilih tapi wajib catatan justifikasi.

import { useCallback, useEffect, useState } from 'react';
import { Users, TriangleAlert as AlertTriangle, ShieldAlert, CircleCheck as CheckCircle2, Save } from 'lucide-react';
import type { Auditor, AuditScope, AuditSchedule, Seksi } from '../../../lib/types';
import {
  getActiveAuditors,
  checkKompetensi,
  checkIndependensi,
} from '../../../services/auditorService';
import {
  getTeamBySchedule,
  upsertTeam,
} from '../../../services/auditTeamService';
import { toDateInput, formatTanggal } from '../../../lib/utils';
import { Button, Card, Badge, LoadingSpinner, EmptyState } from '../../ui';
import { Field, Textarea } from '../../ui/Field';

interface TimAuditTabProps {
  schedule: AuditSchedule;
  scopes: AuditScope[];
  seksiList: Seksi[];
  readOnly: boolean;
  onError: (msg: string) => void;
}

interface AuditorValidation {
  kompetensi: ReturnType<typeof checkKompetensi>;
  independensi: ReturnType<typeof checkIndependensi>;
}

export function TimAuditTab({
  schedule,
  scopes,
  seksiList,
  readOnly,
  onError,
}: TimAuditTabProps) {
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadAuditorId, setLeadAuditorId] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [auditeeOwnerIds, setAuditeeOwnerIds] = useState<string[]>([]);
  const [catatanJustifikasi, setCatatanJustifikasi] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const auditDate = schedule.tanggal_mulai ?? null;

  // Resolve nama-nama seksi yang diaudit dari scopes
  const auditedSeksiNames: string[] = scopes
    .map((s) => {
      const seksi = seksiList.find((sk) => sk.id === s.seksi_terkait);
      return seksi?.nama ?? null;
    })
    .filter((n): n is string => n !== null);

  const loadAuditors = useCallback(async () => {
    setLoading(true);
    try {
      const [activeAuditors, team] = await Promise.all([
        getActiveAuditors(),
        getTeamBySchedule(schedule.id),
      ]);
      setAuditors(activeAuditors);
      setLeadAuditorId(team?.lead_auditor_id ?? null);
      setMemberIds(team?.member_ids ?? []);
      setAuditeeOwnerIds(team?.auditee_area_owner_ids ?? []);
      setCatatanJustifikasi(team?.catatan_justifikasi ?? '');
      setDirty(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Gagal memuat data auditor');
    } finally {
      setLoading(false);
    }
  }, [schedule.id, onError]);

  useEffect(() => {
    loadAuditors();
  }, [loadAuditors]);

  // Build validation map for all auditors
  const validationMap = new Map<string, AuditorValidation>();
  for (const a of auditors) {
    validationMap.set(a.id, {
      kompetensi: checkKompetensi(a, auditDate),
      independensi: checkIndependensi(a, auditedSeksiNames),
    });
  }

  // Check if any selected auditor has conflict → justifikasi wajib
  const selectedIds = [leadAuditorId, ...memberIds].filter(Boolean) as string[];
  const hasConflictSelected = selectedIds.some((id) => {
    const v = validationMap.get(id);
    return v?.independensi.hasConflict;
  });
  const justifikasiWajib = hasConflictSelected;
  const justifikasiMissing = justifikasiWajib && !catatanJustifikasi.trim();

  function toggleMember(id: string) {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setDirty(true);
  }

  function toggleAuditeeOwner(id: string) {
    setAuditeeOwnerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setDirty(true);
  }

  function handleSelectLead(id: string) {
    setLeadAuditorId(id || null);
    setDirty(true);
  }

  async function handleSave() {
    if (justifikasiMissing) {
      onError('Catatan justifikasi wajib diisi karena ada potensi konflik independensi');
      return;
    }
    setSaving(true);
    try {
      await upsertTeam(schedule.id, {
        lead_auditor_id: leadAuditorId,
        member_ids: memberIds,
        auditee_area_owner_ids: auditeeOwnerIds,
        catatan_justifikasi: justifikasiWajib ? catatanJustifikasi.trim() : null,
      });
      setDirty(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Gagal menyimpan tim audit');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner message="Memuat data auditor..." />;

  if (auditors.length === 0) {
    return (
      <Card className="p-12">
        <EmptyState
          icon={<Users size={40} />}
          title="Belum ada data auditor"
          message="Tambahkan data auditor di modul Training sebelum menyusun tim audit."
        />
      </Card>
    );
  }

  function renderAuditorRow(auditor: Auditor, isLeadOption: boolean) {
    const v = validationMap.get(auditor.id);
    if (!v) return null;

    const isExpired = !v.kompetensi.isEligible;
    const hasConflict = v.independensi.hasConflict;
    const isLead = leadAuditorId === auditor.id;
    const isMember = memberIds.includes(auditor.id);
    const isAuditee = auditeeOwnerIds.includes(auditor.id);

    return (
      <tr key={auditor.id} className={isExpired ? 'opacity-60' : 'hover:bg-gray-50'}>
        <td className="px-3 py-2 w-8">
          {isLeadOption ? (
            <input
              type="radio"
              name="lead-auditor"
              checked={isLead}
              disabled={isExpired || readOnly}
              onChange={() => handleSelectLead(auditor.id)}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
          ) : (
            <input
              type="checkbox"
              checked={isMember}
              disabled={isExpired || readOnly}
              onChange={() => toggleMember(auditor.id)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          )}
        </td>
        <td className="px-3 py-2 text-sm text-gray-900">
          <div className="font-medium">{auditor.nama}</div>
          {auditor.jabatan && (
            <div className="text-xs text-gray-400">{auditor.jabatan}</div>
          )}
        </td>
        <td className="px-3 py-2 text-sm text-gray-600">
          {auditor.departemen ?? '-'}
        </td>
        <td className="px-3 py-2 text-sm text-gray-600">
          {auditor.kualifikasi.length > 0
            ? auditor.kualifikasi.join(', ')
            : '-'}
        </td>
        <td className="px-3 py-2 text-sm text-gray-600">
          {auditor.tanggal_berlaku ? formatTanggal(auditor.tanggal_berlaku) : '-'}
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-col gap-1">
            {isExpired ? (
              <Badge variant="red">
                <span className="flex items-center gap-1">
                  <ShieldAlert size={10} /> Tidak memenuhi syarat
                </span>
              </Badge>
            ) : (
              <Badge variant="green">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={10} /> Memenuhi syarat
                </span>
              </Badge>
            )}
            {hasConflict && (
              <Badge variant="amber">
                <span className="flex items-center gap-1">
                  <AlertTriangle size={10} /> Konflik independensi
                </span>
              </Badge>
            )}
          </div>
        </td>
        <td className="px-3 py-2 w-8">
          {!isExpired && !isLead && (
            <input
              type="checkbox"
              checked={isAuditee}
              disabled={readOnly}
              onChange={() => toggleAuditeeOwner(auditor.id)}
              title="Auditee area owner"
              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
          )}
        </td>
      </tr>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Tim Audit</h3>
          <Badge variant="gray">{auditors.length} auditor tersedia</Badge>
        </div>
        {!readOnly && dirty && (
          <Button size="sm" onClick={handleSave} disabled={saving || justifikasiMissing}>
            <Save size={14} /> {saving ? 'Menyimpan...' : 'Simpan Tim'}
          </Button>
        )}
      </div>

      {/* Info: tanggal referensi untuk cek kompetensi */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        Validasi kompetensi menggunakan tanggal mulai audit:{' '}
        <strong>{auditDate ? formatTanggal(auditDate) : 'hari ini'}</strong>.
        Auditor dengan masa berlaku sertifikasi sudah lewat tidak dapat dipilih.
      </div>

      {/* Warning: konflik independensi */}
      {justifikasiWajib && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} />
            <strong>Berpotensi konflik independensi</strong>
          </div>
          <p className="mb-2">
            Ada auditor dari departemen yang sama dengan area yang diaudit.
            Anda tetap bisa memilih auditor ini, tetapi wajib memberikan catatan justifikasi.
          </p>
        </div>
      )}

      {/* Tim Audit table */}
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-8">
                Lead
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nama Auditor</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Departemen</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Kualifikasi</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Berlaku s/d</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-8">
                Auditee
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {auditors.map((a) => renderAuditorRow(a, true))}
          </tbody>
        </table>
      </Card>

      {/* Lead auditor info */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-3">
          <p className="text-xs text-gray-400">Lead Auditor</p>
          <p className="text-sm font-medium text-gray-900">
            {leadAuditorId
              ? auditors.find((a) => a.id === leadAuditorId)?.nama ?? '-'
              : '— belum dipilih —'}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-400">Anggota Tim</p>
          <p className="text-sm font-medium text-gray-900">{memberIds.length} orang</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-400">Auditee Area Owner</p>
          <p className="text-sm font-medium text-gray-900">{auditeeOwnerIds.length} orang</p>
        </Card>
      </div>

      {/* Catatan justifikasi */}
      {justifikasiWajib && !readOnly && (
        <div className="mt-4">
          <Field label="Catatan Justifikasi Independensi" required>
            <Textarea
              value={catatanJustifikasi}
              onChange={(e) => {
                setCatatanJustifikasi(e.target.value);
                setDirty(true);
              }}
              rows={3}
              placeholder="Jelaskan alasan pemilihan auditor meskipun ada potensi konflik independensi..."
              invalid={justifikasiMissing}
            />
          </Field>
          {justifikasiMissing && (
            <p className="mt-1 text-xs text-red-500">Catatan justifikasi wajib diisi</p>
          )}
        </div>
      )}

      {justifikasiWajib && readOnly && catatanJustifikasi && (
        <div className="mt-4">
          <Card className="p-3">
            <p className="text-xs text-gray-400 mb-1">Catatan Justifikasi Independensi</p>
            <p className="text-sm text-gray-700">{catatanJustifikasi}</p>
          </Card>
        </div>
      )}
    </div>
  );
}
