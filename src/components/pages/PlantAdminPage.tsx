// Admin CRUD untuk master Plant, Target Model, dan Shift.

import { useCallback, useEffect, useState } from 'react';
import { Factory, Plus, Trash2, Pencil, Boxes, Clock } from 'lucide-react';
import type { Plant, TargetModel, Shift } from '../../lib/types';
import {
  getPlants, savePlant, deletePlant,
  getTargetModels, saveTargetModel, deleteTargetModel,
  getShifts, saveShift, deleteShift,
} from '../../services/plantService';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Field, Input, Select } from '../ui/Field';
import { Button, Card, Badge, EmptyState, LoadingSpinner } from '../ui';

type Tab = 'plants' | 'models' | 'shifts';

export function PlantAdminPage() {
  const [tab, setTab] = useState<Tab>('plants');
  const [plants, setPlants] = useState<Plant[]>([]);
  const [models, setModels] = useState<TargetModel[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formNama, setFormNama] = useState('');
  const [formUrutan, setFormUrutan] = useState(0);
  const [formPlantId, setFormPlantId] = useState('');
  const [formAktif, setFormAktif] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nama: string; type: Tab } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, m, s] = await Promise.all([getPlants(), getTargetModels(), getShifts()]);
      setPlants(p); setModels(m); setShifts(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function openCreate() {
    setEditId(null);
    setFormNama(''); setFormUrutan(0); setFormAktif(true);
    setFormPlantId(plants[0]?.id ?? '');
    setEditOpen(true);
  }

  function openEdit(entity: Plant | TargetModel | Shift) {
    setEditId(entity.id);
    setFormNama(entity.nama);
    setFormUrutan(entity.urutan_tampil);
    if ('plant_id' in entity) setFormPlantId(entity.plant_id);
    if ('aktif' in entity) setFormAktif(entity.aktif);
    setEditOpen(true);
  }

  async function handleSave() {
    if (!formNama.trim()) { setError('Nama wajib diisi'); return; }
    try {
      if (tab === 'plants') {
        await savePlant({ id: editId ?? undefined, nama: formNama.trim(), urutan_tampil: formUrutan, aktif: formAktif });
      } else if (tab === 'models') {
        if (!formPlantId) { setError('Plant wajib dipilih'); return; }
        await saveTargetModel({ id: editId ?? undefined, plant_id: formPlantId, nama: formNama.trim(), urutan_tampil: formUrutan });
      } else {
        if (!formPlantId) { setError('Plant wajib dipilih'); return; }
        await saveShift({ id: editId ?? undefined, plant_id: formPlantId, nama: formNama.trim(), urutan_tampil: formUrutan });
      }
      setEditOpen(false);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === 'plants') await deletePlant(confirmDelete.id);
      else if (confirmDelete.type === 'models') await deleteTargetModel(confirmDelete.id);
      else await deleteShift(confirmDelete.id);
      setConfirmDelete(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus');
    }
  }

  if (loading) return <LoadingSpinner message="Memuat data master..." />;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'plants', label: 'Plant', icon: <Factory size={16} /> },
    { id: 'models', label: 'Target Model', icon: <Boxes size={16} /> },
    { id: 'shifts', label: 'Shift', icon: <Clock size={16} /> },
  ];

  const getPlantName = (id: string) => plants.find((p) => p.id === id)?.nama ?? id;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Plant, Model & Shift</h1>
          <p className="mt-1 text-sm text-gray-500">Data master untuk matriks produk dan manufaktur/shift di Instruksi Audit.</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Tambah</Button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'plants' && (plants.length === 0 ? (
        <Card className="p-12"><EmptyState icon={<Factory size={40} />} title="Belum ada plant" message="Tambahkan plant/fabrik terlebih dahulu." /></Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead><tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nama</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Urutan</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Aksi</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {plants.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.nama}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.urutan_tampil}</td>
                  <td className="px-4 py-3"><Badge variant={p.aktif ? 'green' : 'gray'}>{p.aktif ? 'Aktif' : 'Nonaktif'}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} className="p-1 text-gray-400 hover:text-blue-600 mr-1"><Pencil size={14} /></button>
                    <button onClick={() => setConfirmDelete({ id: p.id, nama: p.nama, type: 'plants' })} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      {tab === 'models' && (models.length === 0 ? (
        <Card className="p-12"><EmptyState icon={<Boxes size={40} />} title="Belum ada target model" message="Tambahkan model produk per plant." /></Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead><tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Plant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nama Model</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Urutan</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Aksi</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {models.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">{getPlantName(m.plant_id)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.nama}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{m.urutan_tampil}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(m)} className="p-1 text-gray-400 hover:text-blue-600 mr-1"><Pencil size={14} /></button>
                    <button onClick={() => setConfirmDelete({ id: m.id, nama: m.nama, type: 'models' })} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      {tab === 'shifts' && (shifts.length === 0 ? (
        <Card className="p-12"><EmptyState icon={<Clock size={40} />} title="Belum ada shift" message="Tambahkan shift per plant." /></Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead><tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Plant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nama Shift</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Urutan</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Aksi</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {shifts.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">{getPlantName(s.plant_id)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.nama}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.urutan_tampil}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(s)} className="p-1 text-gray-400 hover:text-blue-600 mr-1"><Pencil size={14} /></button>
                    <button onClick={() => setConfirmDelete({ id: s.id, nama: s.nama, type: 'shifts' })} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      <Modal open={editOpen} onClose={() => setEditOpen(false)}
        title={editId ? `Edit ${tab === 'plants' ? 'Plant' : tab === 'models' ? 'Target Model' : 'Shift'}` : `Tambah ${tab === 'plants' ? 'Plant' : tab === 'models' ? 'Target Model' : 'Shift'}`}
        size="md"
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Batal</Button><Button onClick={handleSave}>Simpan</Button></>}
      >
        <div className="space-y-4">
          {tab !== 'plants' && (
            <Field label="Plant" required>
              <Select value={formPlantId} onChange={(e) => setFormPlantId(e.target.value)}>
                <option value="">— Pilih Plant —</option>
                {plants.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Nama" required><Input value={formNama} onChange={(e) => setFormNama(e.target.value)} /></Field>
          <Field label="Urutan Tampil"><Input type="number" value={formUrutan} onChange={(e) => setFormUrutan(parseInt(e.target.value) || 0)} /></Field>
          {tab === 'plants' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formAktif} onChange={(e) => setFormAktif(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700">Aktif</span>
            </label>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} title="Hapus Data"
        message={`Yakin ingin menghapus "${confirmDelete?.nama}"?`}
        confirmLabel="Hapus" onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}
