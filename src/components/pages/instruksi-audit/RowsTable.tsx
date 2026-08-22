// Tabel baris instruksi audit (audit_instruction_rows).
// Manual add row. Fitur generate otomatis menyusul batch berikutnya.

import { useState } from 'react';
import { Plus, Trash2, Pencil, SquareCheck as CheckSquare, Square } from 'lucide-react';
import type {
  AuditInstructionRow, Proses, Seksi, Auditor, AuditTeamMaster,
  Plant, TargetModel, Shift,
  SeksiMark,
} from '../../../lib/types';
import { TIPE_BARIS_LIST, TIPE_BARIS_LABEL, TIPE_SEKSI_MARK } from '../../../lib/enums';
import type { TipeBaris, TipeSeksiMark } from '../../../lib/enums';
import { saveInstructionRowWithTeam, deleteRow, generateNextKodeAudit, resolvePemilikProses } from '../../../services/auditInstructionService';
import { formatTanggal } from '../../../lib/utils';
import { Modal } from '../../ui/Modal';
import { Field, Input, Select, Textarea } from '../../ui/Field';
import { Button, Card, Badge, EmptyState } from '../../ui';

interface RowsTableProps {
  instructionId: string;
  prefixNomorAudit: string;
  rows: AuditInstructionRow[];
  prosesList: Proses[];
  seksiList: Seksi[];
  auditorList: Auditor[];
  plants: Plant[];
  targetModels: TargetModel[];
  shifts: Shift[];
  readOnly: boolean;
  onReload: () => void;
  onError: (msg: string) => void;
  teamMasters: AuditTeamMaster[];
}

interface RowForm {
  team_master_id: string;
  catatan_justifikasi_tim: string;
  proses_id: string;
  tipe_baris: TipeBaris;
  seksi_marks: SeksiMark[];
  matriks_produk_marks: { plant_id: string; target_model_id: string }[];
  matriks_manufaktur_shift_marks: { plant_id: string; shift_id: string }[];
  tanggal_audit_produk: string;
  nama_auditor_produk: string;
  kualifikasi: string;
  item_lain_diperiksa: string;
  tanggal_plan_audit: string;
  tanggal_pelaksanaan_audit: string;
}

function emptyForm(): RowForm {
  return {
    team_master_id: '', catatan_justifikasi_tim: '', proses_id: '', tipe_baris: 'Reguler',
    seksi_marks: [],
    matriks_produk_marks: [], matriks_manufaktur_shift_marks: [],
    tanggal_audit_produk: '', nama_auditor_produk: '', kualifikasi: '',
    item_lain_diperiksa: '', tanggal_plan_audit: '', tanggal_pelaksanaan_audit: '',
  };
}

export function RowsTable({
  instructionId, prefixNomorAudit, rows, prosesList, seksiList, auditorList,
  plants, targetModels, shifts, readOnly, onReload, onError, teamMasters,
}: RowsTableProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AuditInstructionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RowForm>(emptyForm());

  function openCreate() { setEditingRow(null); setForm(emptyForm()); setEditOpen(true); }

  function openEdit(row: AuditInstructionRow) {
    setEditingRow(row);
    setForm({
      team_master_id: row.team_master_id ?? '', catatan_justifikasi_tim: row.catatan_justifikasi_tim ?? '', proses_id: row.proses_id ?? '', tipe_baris: row.tipe_baris,
      seksi_marks: row.seksi_marks ?? [],
      matriks_produk_marks: row.matriks_produk_marks ?? [],
      matriks_manufaktur_shift_marks: row.matriks_manufaktur_shift_marks ?? [],
      tanggal_audit_produk: row.tanggal_audit_produk ?? '', nama_auditor_produk: row.nama_auditor_produk ?? '',
      kualifikasi: row.kualifikasi ?? '', item_lain_diperiksa: row.item_lain_diperiksa ?? '',
      tanggal_plan_audit: row.tanggal_plan_audit ?? '', tanggal_pelaksanaan_audit: row.tanggal_pelaksanaan_audit ?? '',
    });
    setEditOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const isReguler = form.tipe_baris === 'Reguler';
      const isProduk = form.tipe_baris === 'AuditProduk';
      const isManufakturOrShift = form.tipe_baris === 'AuditManufaktur' || form.tipe_baris === 'AuditShift';

      // tipeBaris eksklusif: Reguler mengunci matriks lain, tipe khusus mengunci matriks Seksi
      const finalSeksiMarks = isReguler ? form.seksi_marks : [];
      const finalProdukMarks = isProduk ? form.matriks_produk_marks : [];
      const finalManufakturMarks = isManufakturOrShift ? form.matriks_manufaktur_shift_marks : [];

      const pemilikProses = resolvePemilikProses(form.proses_id || null, prosesList, seksiList, finalSeksiMarks);

      if (editingRow) {
        await saveInstructionRowWithTeam({
          ...editingRow,
          team_master_id: form.team_master_id || null,
          proses_id: form.proses_id || null, pemilik_proses: pemilikProses,
          seksi_marks: finalSeksiMarks, tipe_baris: form.tipe_baris,
          matriks_produk_marks: finalProdukMarks, matriks_manufaktur_shift_marks: finalManufakturMarks,
          tanggal_audit_produk: form.tanggal_audit_produk || null,
          nama_auditor_produk: form.nama_auditor_produk || null,
          kualifikasi: form.kualifikasi || null, item_lain_diperiksa: form.item_lain_diperiksa || null,
          tanggal_plan_audit: form.tanggal_plan_audit || null,
          tanggal_pelaksanaan_audit: form.tanggal_pelaksanaan_audit || null,
          catatan_justifikasi_tim: form.catatan_justifikasi_tim || null,
          cek_selesai: editingRow.cek_selesai,
        });
      } else {
        const kodeAudit = await generateNextKodeAudit(prefixNomorAudit);
        await saveInstructionRowWithTeam({
          instruction_id: instructionId, kode_audit: kodeAudit,
          team: null, team_master_id: form.team_master_id || null, catatan_justifikasi_tim: form.catatan_justifikasi_tim || null, proses_id: form.proses_id || null, pemilik_proses: pemilikProses,
          seksi_marks: finalSeksiMarks, auditor: [], tipe_baris: form.tipe_baris,
          matriks_produk_marks: finalProdukMarks, matriks_manufaktur_shift_marks: finalManufakturMarks,
          tanggal_audit_produk: form.tanggal_audit_produk || null,
          nama_auditor_produk: form.nama_auditor_produk || null,
          kualifikasi: form.kualifikasi || null, item_lain_diperiksa: form.item_lain_diperiksa || null,
          tanggal_plan_audit: form.tanggal_plan_audit || null,
          tanggal_pelaksanaan_audit: form.tanggal_pelaksanaan_audit || null,
          cek_selesai: false,
        });
      }
      setEditOpen(false);
      onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Gagal menyimpan baris');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: AuditInstructionRow) {
    try { await deleteRow(row.id); onReload(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Gagal menghapus baris'); }
  }

  // Seksi mark helpers
  function toggleSeksiMark(seksiId: string) {
    setForm((prev) => {
      if (prev.seksi_marks.find((m) => m.seksi_id === seksiId))
        return { ...prev, seksi_marks: prev.seksi_marks.filter((m) => m.seksi_id !== seksiId) };
      return { ...prev, seksi_marks: [...prev.seksi_marks, { seksi_id: seksiId, tipe: TIPE_SEKSI_MARK.TARGET }] };
    });
  }
  function setSeksiMarkTipe(seksiId: string, tipe: TipeSeksiMark) {
    setForm((prev) => ({ ...prev, seksi_marks: prev.seksi_marks.map((m) => m.seksi_id === seksiId ? { ...m, tipe } : m) }));
  }

  // Matriks produk helpers
  function toggleProdukMark(plantId: string, modelId: string) {
    setForm((prev) => {
      if (prev.matriks_produk_marks.find((m) => m.plant_id === plantId && m.target_model_id === modelId))
        return { ...prev, matriks_produk_marks: prev.matriks_produk_marks.filter((m) => !(m.plant_id === plantId && m.target_model_id === modelId)) };
      return { ...prev, matriks_produk_marks: [...prev.matriks_produk_marks, { plant_id: plantId, target_model_id: modelId }] };
    });
  }

  // Matriks manufaktur/shift helpers
  function toggleManufakturMark(plantId: string, shiftId: string) {
    setForm((prev) => {
      if (prev.matriks_manufaktur_shift_marks.find((m) => m.plant_id === plantId && m.shift_id === shiftId))
        return { ...prev, matriks_manufaktur_shift_marks: prev.matriks_manufaktur_shift_marks.filter((m) => !(m.plant_id === plantId && m.shift_id === shiftId)) };
      return { ...prev, matriks_manufaktur_shift_marks: [...prev.matriks_manufaktur_shift_marks, { plant_id: plantId, shift_id: shiftId }] };
    });
  }

  const isReguler = form.tipe_baris === 'Reguler';
  const isProduk = form.tipe_baris === 'AuditProduk';
  const isManufakturOrShift = form.tipe_baris === 'AuditManufaktur' || form.tipe_baris === 'AuditShift';

  function getProsesName(id: string | null): string {
    if (!id) return '-';
    return prosesList.find((p) => p.id === id)?.nama_proses ?? id;
  }
  function getTeamAuditorNames(teamId: string | null): string {
    const team = teamMasters.find((candidate) => candidate.id === teamId);
    if (!team) return '-';
    const resolve = (id: string) => team.members.find((member) => member.auditor_id === id)?.auditor?.nama ?? auditorList.find((auditor) => auditor.id === id)?.nama ?? id;
    const lead = team.members.find((member) => member.peran === 'Lead');
    const members = team.members.filter((member) => member.peran === 'Member').map((member) => resolve(member.auditor_id));
    return `${lead ? `Lead Auditor: ${resolve(lead.auditor_id)}` : 'Lead Auditor: -'}${members.length ? `; Member: ${members.join(', ')}` : ''}`;
  }

  // Matrix display helpers
  function seksiMarkSymbol(seksiId: string, marks: SeksiMark[]): string {
    const mark = marks.find((m) => m.seksi_id === seksiId);
    if (!mark) return '';
    return mark.tipe === TIPE_SEKSI_MARK.TARGET ? '★' : '•';
  }

  function isProdukMarked(plantId: string, modelId: string, marks: { plant_id: string; target_model_id: string }[]): boolean {
    return marks.some((m) => m.plant_id === plantId && m.target_model_id === modelId);
  }

  function isManufakturMarked(plantId: string, shiftId: string, marks: { plant_id: string; shift_id: string }[]): boolean {
    return marks.some((m) => m.plant_id === plantId && m.shift_id === shiftId);
  }

  // Build flat column lists for 2-level headers
  const produkCols = plants.flatMap((p) =>
    targetModels.filter((m) => m.plant_id === p.id).map((m) => ({ plant: p, model: m }))
  );
  const manufakturCols = plants.flatMap((p) =>
    shifts.filter((s) => s.plant_id === p.id).map((s) => ({ plant: p, shift: s }))
  );

  // Colspan for plant group headers
  function plantColspan(plantId: string, type: 'produk' | 'manufaktur'): number {
    if (type === 'produk') return targetModels.filter((m) => m.plant_id === plantId).length;
    return shifts.filter((s) => s.plant_id === plantId).length;
  }

  // Nama seksi diputar sebagai satu frasa; panjang nama menambah tinggi header, bukan lebar kolom.
  const longestSeksiName = seksiList.reduce((longest, seksi) => Math.max(longest, seksi.nama.length), 0);
  const seksiHeaderHeight = Math.min(260, Math.max(120, longestSeksiName * 6 + 32));
  function getSeksiColumnWidth(name: string): number {
    if (name.length <= 8) return 38;
    if (name.length <= 18) return 46;
    if (name.length <= 28) return 54;
    return 60;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Daftar Audit</h3>
          <Badge variant="gray">{rows.length} baris</Badge>
        </div>
        {!readOnly && <Button size="sm" onClick={openCreate}><Plus size={14} /> Tambah Baris</Button>}
      </div>

      {rows.length === 0 ? (
        <Card className="p-12">
          <EmptyState title="Belum ada baris audit" message="Klik 'Generate dari Program' di halaman daftar instruksi untuk auto-generate, atau tambah baris manual."
            action={!readOnly ? <Button size="sm" onClick={openCreate}><Plus size={14} /> Tambah Baris</Button> : undefined} />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* Row 1: top-level group headers */}
              <tr className="border-b border-gray-200 bg-gray-50">
                <th rowSpan={2} className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-r border-gray-200">No. Audit</th>
                <th rowSpan={2} className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-r border-gray-200">Tipe</th>
                <th rowSpan={2} className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-r border-gray-200">Team</th>
                <th rowSpan={2} className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-r border-gray-200">Proses</th>
                <th rowSpan={2} className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-r border-gray-200">Pemilik Proses</th>
                <th rowSpan={2} className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-r border-gray-200">Auditor</th>
                {/* Matriks Seksi */}
                <th colSpan={seksiList.length} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">Matriks Seksi</th>
                {/* Matriks Audit Produk */}
                {produkCols.length > 0 && (
                  <th colSpan={produkCols.length} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">Matriks Audit Produk</th>
                )}
                {/* Matriks Manufaktur & Shift */}
                {manufakturCols.length > 0 && (
                  <th colSpan={manufakturCols.length} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase border-r border-gray-200">Manufaktur & Shift</th>
                )}
                <th rowSpan={2} className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-r border-gray-200">Item Lain</th>
                <th rowSpan={2} className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-r border-gray-200">Tanggal Plan</th>
                <th rowSpan={2} className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-r border-gray-200">Pelaksanaan</th>
                <th rowSpan={2} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-r border-gray-200">Cek</th>
                <th rowSpan={2} className="px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap border-r border-gray-200">Status</th>
                <th rowSpan={2} className="px-2 py-2 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Aksi</th>
              </tr>
              {/* Row 2: sub-level headers */}
              <tr className="border-b border-gray-200 bg-gray-50">
                {/* Seksi sub-headers */}
                {seksiList.map((s) => (
                  <th
                    key={s.id}
                    className="p-0 text-center text-[10px] font-medium text-gray-500 border-r border-gray-100"
                    style={{
                      width: getSeksiColumnWidth(s.nama),
                      minWidth: getSeksiColumnWidth(s.nama),
                      maxWidth: getSeksiColumnWidth(s.nama),
                      height: seksiHeaderHeight,
                    }}
                    title={s.nama}
                  >
                    <div
                      className="relative w-full overflow-visible"
                      style={{ height: seksiHeaderHeight }}
                    >
                      <span
                        className="absolute whitespace-nowrap text-xs font-semibold text-gray-700 leading-none"
                        style={{
                          left: '50%',
                          bottom: 10,
                          transform: 'rotate(-90deg)',
                          transformOrigin: 'left center',
                        }}
                      >
                        {s.nama}
                      </span>
                    </div>
                  </th>
                ))}
                {/* Produk: Plant → Model sub-headers */}
                {produkCols.map(({ plant, model }) => (
                  <th key={`${plant.id}-${model.id}`} className="px-1 py-1 text-center text-[10px] font-medium text-gray-400 whitespace-nowrap" title={`${plant.nama} → ${model.nama}`}>
                    {model.nama}
                  </th>
                ))}
                {/* Manufaktur: Plant → Shift sub-headers */}
                {manufakturCols.map(({ plant, shift }) => (
                  <th key={`${plant.id}-${shift.id}`} className="px-1 py-1 text-center text-[10px] font-medium text-gray-400 whitespace-nowrap" title={`${plant.nama} → ${shift.nama}`}>
                    {shift.nama}
                  </th>
                ))}
              </tr>
              {/* Row 3: plant group labels (only for produk & manufaktur) */}
              {plants.length > 0 && (produkCols.length > 0 || manufakturCols.length > 0) && (
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th colSpan={6} className="px-2 py-1 border-r border-gray-200"></th>
                  {seksiList.length > 0 && <th colSpan={seksiList.length} className="border-r border-gray-200"></th>}
                  {plants.map((p) => {
                    const pc = plantColspan(p.id, 'produk');
                    return pc > 0 ? (
                      <th key={p.id} colSpan={pc} className="px-1 py-1 text-center text-[9px] font-medium text-gray-400 border-r border-gray-100">{p.nama}</th>
                    ) : null;
                  })}
                  {plants.map((p) => {
                    const mc = plantColspan(p.id, 'manufaktur');
                    return mc > 0 ? (
                      <th key={p.id} colSpan={mc} className="px-1 py-1 text-center text-[9px] font-medium text-gray-400 border-r border-gray-100">{p.nama}</th>
                    ) : null;
                  })}
                  <th colSpan={4} className="border-r border-gray-200"></th>
                  <th></th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const isSpecial = row.tipe_baris !== 'Reguler';
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2 font-mono text-xs font-medium text-gray-900 whitespace-nowrap border-r border-gray-100">{row.kode_audit}</td>
                    <td className="px-2 py-2 whitespace-nowrap border-r border-gray-100">
                      {isSpecial ? (
                        <Badge variant="blue">{TIPE_BARIS_LABEL[row.tipe_baris]}</Badge>
                      ) : (
                        <Badge variant="gray">{TIPE_BARIS_LABEL[row.tipe_baris]}</Badge>
                      )}
                    </td>
                    <td className="px-2 py-2 text-gray-700 text-xs border-r border-gray-100">{teamMasters.find((team) => team.id === row.team_master_id) ? `${teamMasters.find((team) => team.id === row.team_master_id)!.kode_tim} — ${teamMasters.find((team) => team.id === row.team_master_id)!.nama_tim}` : '-'}</td>
                    <td className="px-2 py-2 text-gray-700 text-xs border-r border-gray-100">{getProsesName(row.proses_id)}</td>
                    <td className="px-2 py-2 text-gray-700 text-xs border-r border-gray-100">{row.pemilik_proses ?? '-'}</td>
                    <td className="px-2 py-2 text-gray-700 text-xs border-r border-gray-100">{getTeamAuditorNames(row.team_master_id)}</td>
                    {/* Matriks Seksi cells */}
                    {seksiList.map((s) => (
                      <td
                        key={s.id}
                        className="px-1 py-2 text-center text-sm border-r border-gray-50"
                        style={{
                          width: getSeksiColumnWidth(s.nama),
                          minWidth: getSeksiColumnWidth(s.nama),
                          maxWidth: getSeksiColumnWidth(s.nama),
                        }}
                      >
                        <span className={seksiMarkSymbol(s.id, row.seksi_marks) === '★' ? 'text-blue-600' : 'text-gray-400'}>
                          {seksiMarkSymbol(s.id, row.seksi_marks) || <span className="text-gray-200">·</span>}
                        </span>
                      </td>
                    ))}
                    {/* Matriks Produk cells */}
                    {produkCols.map(({ plant, model }) => (
                      <td key={`${plant.id}-${model.id}`} className="px-1 py-2 text-center text-xs border-r border-gray-50">
                        <span className={isProdukMarked(plant.id, model.id, row.matriks_produk_marks) ? 'text-blue-600 font-bold' : 'text-gray-200'}>
                          {isProdukMarked(plant.id, model.id, row.matriks_produk_marks) ? '✓' : '·'}
                        </span>
                      </td>
                    ))}
                    {/* Matriks Manufaktur cells */}
                    {manufakturCols.map(({ plant, shift }) => (
                      <td key={`${plant.id}-${shift.id}`} className="px-1 py-2 text-center text-xs border-r border-gray-50">
                        <span className={isManufakturMarked(plant.id, shift.id, row.matriks_manufaktur_shift_marks) ? 'text-blue-600 font-bold' : 'text-gray-200'}>
                          {isManufakturMarked(plant.id, shift.id, row.matriks_manufaktur_shift_marks) ? '✓' : '·'}
                        </span>
                      </td>
                    ))}
                    <td className="px-2 py-2 text-gray-600 text-xs border-r border-gray-100 max-w-[120px] truncate" title={row.item_lain_diperiksa ?? ''}>{row.item_lain_diperiksa ?? '-'}</td>
                    <td className="px-2 py-2 text-gray-600 text-xs whitespace-nowrap border-r border-gray-100">{row.tanggal_plan_audit ? formatTanggal(row.tanggal_plan_audit) : '-'}</td>
                    <td className="px-2 py-2 text-gray-600 text-xs whitespace-nowrap border-r border-gray-100">{row.tanggal_pelaksanaan_audit ? formatTanggal(row.tanggal_pelaksanaan_audit) : '-'}</td>
                    <td className="px-2 py-2 text-center border-r border-gray-100">
                      <span className="inline-flex" title="Status ini dikelola melalui Pelaksanaan Audit">
                        {row.cek_selesai ? <CheckSquare size={16} className="text-green-600" /> : <Square size={16} className="text-gray-300" />}
                      </span>
                    </td>
                    <td className="px-2 py-2 border-r border-gray-100"><Badge variant="gray">Lihat Pelaksanaan</Badge></td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {!readOnly && (<>
                        <button onClick={() => openEdit(row)} className="p-1 text-gray-400 hover:text-blue-600 mr-1" title="Edit"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(row)} className="p-1 text-gray-400 hover:text-red-500" title="Hapus"><Trash2 size={14} /></button>
                      </>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)}
        title={editingRow ? `Edit Baris ${editingRow.kode_audit}` : 'Tambah Baris Audit'}
        size="xl"
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Batal</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button></>}
      >
        <div className="space-y-4">
          <Field label="Tipe Baris" required>
            <Select value={form.tipe_baris} onChange={(e) => setForm({ ...form, tipe_baris: e.target.value as TipeBaris })}>
              {TIPE_BARIS_LIST.map((t) => <option key={t} value={t}>{TIPE_BARIS_LABEL[t]}</option>)}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Team Audit"><Select value={form.team_master_id} onChange={(e) => setForm({ ...form, team_master_id: e.target.value })}><option value="">— Belum dipilih —</option>{teamMasters.map((team) => <option key={team.id} value={team.id} disabled={team.status !== 'Aktif' || !team.is_locked}>{team.kode_tim} — {team.nama_tim}{!team.is_locked ? ' (Belum dikunci)' : ''}</option>)}</Select></Field>
            <Field label="Proses">
              <Select value={form.proses_id} onChange={(e) => setForm({ ...form, proses_id: e.target.value })}>
                <option value="">— Pilih Proses —</option>
                {prosesList.map((p) => <option key={p.id} value={p.id}>{p.kode_proses} — {p.nama_proses}</option>)}
              </Select>
            </Field>
          </div>

          {isReguler && (
            <Field label="Seksi Marks (Target/Terkait)">
              <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                {seksiList.map((s) => {
                  const mark = form.seksi_marks.find((m) => m.seksi_id === s.id);
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <input type="checkbox" checked={!!mark} onChange={() => toggleSeksiMark(s.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                      <span className="text-sm flex-1">{s.nama}</span>
                      {mark && (
                        <Select value={mark.tipe} onChange={(e) => setSeksiMarkTipe(s.id, e.target.value as TipeSeksiMark)} className="w-32">
                          <option value={TIPE_SEKSI_MARK.TARGET}>Target</option>
                          <option value={TIPE_SEKSI_MARK.TERKAIT}>Terkait</option>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Auditor"><Input readOnly value={getTeamAuditorNames(form.team_master_id)} /></Field>
          <Field label="Catatan Justifikasi Tim"><Textarea value={form.catatan_justifikasi_tim} onChange={(e) => setForm({ ...form, catatan_justifikasi_tim: e.target.value })} placeholder="Wajib jika terdapat potensi konflik independensi." /></Field>

          {isProduk && (
            <Field label="Matriks Produk (Plant x Target Model)">
              <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                {plants.map((plant) => {
                  const plantModels = targetModels.filter((m) => m.plant_id === plant.id);
                  if (plantModels.length === 0) return null;
                  return (
                    <div key={plant.id} className="mb-3">
                      <p className="text-xs font-medium text-gray-600 mb-1">{plant.nama}</p>
                      <div className="flex flex-wrap gap-2">
                        {plantModels.map((model) => {
                          const checked = form.matriks_produk_marks.some((m) => m.plant_id === plant.id && m.target_model_id === model.id);
                          return (
                            <label key={model.id} className="flex items-center gap-1 text-sm cursor-pointer">
                              <input type="checkbox" checked={checked} onChange={() => toggleProdukMark(plant.id, model.id)} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600" />
                              {model.nama}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Field>
          )}

          {isManufakturOrShift && (
            <Field label="Matriks Manufaktur/Shift (Plant x Shift)">
              <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                {plants.map((plant) => {
                  const plantShifts = shifts.filter((s) => s.plant_id === plant.id);
                  if (plantShifts.length === 0) return null;
                  return (
                    <div key={plant.id} className="mb-3">
                      <p className="text-xs font-medium text-gray-600 mb-1">{plant.nama}</p>
                      <div className="flex flex-wrap gap-2">
                        {plantShifts.map((shift) => {
                          const checked = form.matriks_manufaktur_shift_marks.some((m) => m.plant_id === plant.id && m.shift_id === shift.id);
                          return (
                            <label key={shift.id} className="flex items-center gap-1 text-sm cursor-pointer">
                              <input type="checkbox" checked={checked} onChange={() => toggleManufakturMark(plant.id, shift.id)} className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600" />
                              {shift.nama}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Field>
          )}

          {isProduk && (<>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tanggal Audit Produk"><Input type="date" value={form.tanggal_audit_produk} onChange={(e) => setForm({ ...form, tanggal_audit_produk: e.target.value })} /></Field>
              <Field label="Kualifikasi">
                <Select value={form.kualifikasi} onChange={(e) => setForm({ ...form, kualifikasi: e.target.value })}>
                  <option value="">—</option><option value="Y">Y</option><option value="N">N</option>
                </Select>
              </Field>
            </div>
            <Field label="Nama Auditor Produk">
              <div className="flex items-center gap-2">
                <Input value={form.nama_auditor_produk} onChange={(e) => setForm({ ...form, nama_auditor_produk: e.target.value })} placeholder="Kosongkan lalu klik tombol di kanan" />
                <Button variant="secondary" size="sm" onClick={() => setForm({ ...form, nama_auditor_produk: '(Lihat kolom Auditor)' })} title="Isi dengan placeholder referensi ke kolom Auditor">Sama dengan Auditor</Button>
              </div>
              {form.nama_auditor_produk === '(Lihat kolom Auditor)' && (
                <p className="mt-1 text-xs text-blue-600">Label diisi "(Lihat kolom Auditor)" — merujuk ke kolom Auditor di baris ini.</p>
              )}
            </Field>
          </>)}

          <Field label="Item Lain Diperiksa"><Textarea value={form.item_lain_diperiksa} onChange={(e) => setForm({ ...form, item_lain_diperiksa: e.target.value })} rows={2} placeholder="Item lain yang diperiksa..." /></Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tanggal Plan Audit"><Input type="date" value={form.tanggal_plan_audit} onChange={(e) => setForm({ ...form, tanggal_plan_audit: e.target.value })} /></Field>
            <Field label="Tanggal Pelaksanaan Audit"><Input type="date" value={form.tanggal_pelaksanaan_audit} onChange={(e) => setForm({ ...form, tanggal_pelaksanaan_audit: e.target.value })} /></Field>
          </div>

          {editingRow && <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">Status selesai: <strong>{editingRow.cek_selesai ? 'Selesai' : 'Belum selesai'}</strong>. Penyelesaian hanya dapat dilakukan melalui Pelaksanaan Audit.</div>}
        </div>
      </Modal>
    </div>
  );
}
