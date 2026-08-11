// Halaman Instruksi Internal Audit — list + detail view.
// List menampilkan semua instruksi; detail menampilkan header + RowsTable.

import { useCallback, useEffect, useState } from 'react';
import { FileCheck, Plus, Trash2, Pencil, Eye } from 'lucide-react';
import type {
  AuditInstruction, AuditInstructionRow,
  Proses, Seksi, Auditor,
  Plant, TargetModel, Shift,
} from '../../lib/types';
import {
  getInstructions, getInstructionById, saveInstruction, deleteInstruction,
  getRowsByInstruction,
} from '../../services/auditInstructionService';
import { getAllProses } from '../../services/prosesService';
import { getSeksiList } from '../../services/seksiService';
import { getActiveAuditors } from '../../services/auditorService';
import { getPlants, getTargetModels, getShifts } from '../../services/plantService';
import { INSTRUCTION_STATUS_LIST, KODE_DOKUMEN_INSTRUCTION } from '../../lib/enums';
import type { InstructionStatus } from '../../lib/enums';
import { formatTanggal, toDateInput } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { Button, Card, Badge, EmptyState, LoadingSpinner } from '../ui';
import { InstructionHeader } from './instruksi-audit/InstructionHeader';
import { RowsTable } from './instruksi-audit/RowsTable';

const STATUS_BADGE: Record<string, 'gray' | 'green' | 'blue'> = {
  Draft: 'gray', Berjalan: 'blue', Selesai: 'green',
};

export function InstruksiAuditPage() {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [instructions, setInstructions] = useState<AuditInstruction[]>([]);
  const [detailInstruction, setDetailInstruction] = useState<AuditInstruction | null>(null);
  const [rows, setRows] = useState<AuditInstructionRow[]>([]);
  const [prosesList, setProsesList] = useState<Proses[]>([]);
  const [seksiList, setSeksiList] = useState<Seksi[]>([]);
  const [auditorList, setAuditorList] = useState<Auditor[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [targetModels, setTargetModels] = useState<TargetModel[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ tahun_fiskal: new Date().getFullYear(), tujuan_audit: '', prefix_nomor_audit: 'QA-' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AuditInstruction | null>(null);
  const [headerChanged, setHeaderChanged] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInstructions();
      setInstructions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetailDeps = useCallback(async () => {
    try {
      const [p, s, a, pl, tm, sh] = await Promise.all([
        getAllProses(), getSeksiList(), getActiveAuditors(),
        getPlants(), getTargetModels(), getShifts(),
      ]);
      setProsesList(p); setSeksiList(s); setAuditorList(a);
      setPlants(pl); setTargetModels(tm); setShifts(sh);
    } catch {
      // deps load failure non-fatal — rows table handles empty arrays
    }
  }, []);

  const loadRows = useCallback(async (instructionId: string) => {
    try {
      const r = await getRowsByInstruction(instructionId);
      setRows(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat baris');
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  async function openDetail(instr: AuditInstruction) {
    setView('detail');
    setDetailInstruction(instr);
    setHeaderChanged(false);
    setError(null);
    await Promise.all([loadDetailDeps(), loadRows(instr.id)]);
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const created = await saveInstruction({
        tahun_fiskal: createForm.tahun_fiskal,
        tujuan_audit: createForm.tujuan_audit || null,
        prefix_nomor_audit: createForm.prefix_nomor_audit,
        kode_dokumen: KODE_DOKUMEN_INSTRUCTION,
        status: 'Draft',
      });
      setCreateOpen(false);
      setCreateForm({ tahun_fiskal: new Date().getFullYear(), tujuan_audit: '', prefix_nomor_audit: 'QA-' });
      await loadList();
      await openDetail(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat instruksi');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteInstruction(confirmDelete.id);
      setConfirmDelete(null);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus');
    }
  }

  async function handleHeaderSave() {
    if (!detailInstruction) return;
    try {
      const updated = await saveInstruction(detailInstruction);
      setDetailInstruction(updated);
      setHeaderChanged(false);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan header');
    }
  }

  function handleHeaderFieldChange(field: string, value: unknown) {
    if (!detailInstruction) return;
    setDetailInstruction({ ...detailInstruction, [field]: value });
    setHeaderChanged(true);
  }

  if (loading && view === 'list') return <LoadingSpinner message="Memuat instruksi audit..." />;

  if (view === 'detail' && detailInstruction) {
    const readOnly = detailInstruction.status === 'Selesai';
    return (
      <div>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        <InstructionHeader
          instruction={detailInstruction}
          rowCount={rows.length}
          readOnly={readOnly}
          onFieldChange={handleHeaderFieldChange}
          onBack={() => { setView('list'); setDetailInstruction(null); setRows([]); }}
        />
        {headerChanged && (
          <div className="mb-4 flex justify-end">
            <Button onClick={handleHeaderSave}>Simpan Header</Button>
          </div>
        )}
        <RowsTable
          instructionId={detailInstruction.id}
          prefixNomorAudit={detailInstruction.prefix_nomor_audit}
          rows={rows}
          prosesList={prosesList}
          seksiList={seksiList}
          auditorList={auditorList}
          plants={plants}
          targetModels={targetModels}
          shifts={shifts}
          readOnly={readOnly}
          onReload={() => loadRows(detailInstruction.id)}
          onError={(msg) => setError(msg)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instruksi Internal Audit</h1>
          <p className="mt-1 text-sm text-gray-500">Daftar instruksi audit dan baris pelaksanaannya.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus size={16} /> Buat Instruksi</Button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {instructions.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            icon={<FileCheck size={40} />}
            title="Belum ada instruksi audit"
            message="Buat instruksi audit baru untuk mulai menambahkan baris pelaksanaan."
            action={<Button onClick={() => setCreateOpen(true)}><Plus size={16} /> Buat Instruksi</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tahun Fiskal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kode Dokumen</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tujuan Audit</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal Buat</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Aksi</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {instructions.map((instr) => (
                <tr key={instr.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(instr)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">FY {instr.tahun_fiskal}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">{instr.kode_dokumen}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{instr.tujuan_audit ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{instr.tanggal_buat ? formatTanggal(instr.tanggal_buat) : '-'}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS_BADGE[instr.status] ?? 'gray'}>{instr.status}</Badge></td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openDetail(instr)} className="p-1 text-gray-400 hover:text-blue-600 mr-1" title="Lihat detail"><Eye size={14} /></button>
                    <button onClick={() => openDetail(instr)} className="p-1 text-gray-400 hover:text-blue-600 mr-1" title="Edit"><Pencil size={14} /></button>
                    <button onClick={() => setConfirmDelete(instr)} className="p-1 text-gray-400 hover:text-red-500" title="Hapus"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)}
        title="Buat Instruksi Internal Audit"
        size="md"
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Batal</Button><Button onClick={handleCreate} disabled={saving}>{saving ? 'Menyimpan...' : 'Buat'}</Button></>}
      >
        <div className="space-y-4">
          <Field label="Tahun Fiskal" required>
            <Input type="number" value={createForm.tahun_fiskal} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm({ ...createForm, tahun_fiskal: parseInt(e.target.value) || new Date().getFullYear() })} />
          </Field>
          <Field label="Prefix Nomor Audit">
            <Input value={createForm.prefix_nomor_audit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm({ ...createForm, prefix_nomor_audit: e.target.value })} placeholder="QA-" />
          </Field>
          <Field label="Tujuan Audit">
            <Textarea value={createForm.tujuan_audit} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCreateForm({ ...createForm, tujuan_audit: e.target.value })} rows={3} placeholder="Tujuan pelaksanaan internal audit..." />
          </Field>
          <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <p>Kode dokumen: <span className="font-mono font-medium text-gray-700">{KODE_DOKUMEN_INSTRUCTION}</span></p>
            <p className="mt-1">Status awal: <Badge variant="gray">Draft</Badge></p>
            <p className="mt-1">Tanggal buat: {toDateInput(new Date())}</p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} title="Hapus Instruksi Audit"
        message={`Yakin ingin menghapus instruksi FY ${confirmDelete?.tahun_fiskal}? Semua baris audit juga akan terhapus.`}
        confirmLabel="Hapus" onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}
