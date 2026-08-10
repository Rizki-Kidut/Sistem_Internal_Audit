// Wizard 2-langkah untuk membuat Jadwal Audit baru.
// Langkah 1: kode auto, tanggal mulai/selesai, jenis audit, standar (checkbox multi).
// Langkah 2: multi-select area dari prosesMaster + area kustom,
//   tiap area wajib assign Seksi Terkait + PIC Area (default kepala seksi).

import { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft, Check, Plus, X } from 'lucide-react';
import type { Proses, Seksi } from '../../../lib/types';
import { JENIS_AUDIT_LIST, STANDAR_AUDIT_LIST } from '../../../lib/enums';
import type { JenisAudit, StandarAudit } from '../../../lib/enums';
import type { ScopeInput } from '../../../services/auditScheduleService';
import { getDefaultPicArea } from '../../../services/auditScheduleService';
import { generateKodeAuditSchedule } from '../../../lib/codeGenerator';
import { Modal } from '../../ui/Modal';
import { Field, Input, Select, AutoFilledBadge } from '../../ui/Field';
import { Button, Badge } from '../../ui';

interface CreateWizardModalProps {
  open: boolean;
  onClose: () => void;
  prosesList: Proses[];
  seksiList: Seksi[];
  onCreate: (data: {
    tahun: number;
    tanggal_mulai: string | null;
    tanggal_selesai: string | null;
    jenis_audit: JenisAudit;
    standar: StandarAudit[];
    scopes: ScopeInput[];
  }) => Promise<void>;
}

interface AreaRow extends ScopeInput {
  id: string;
  isCustom: boolean;
  selected: boolean;
}

export function CreateWizardModal({
  open,
  onClose,
  prosesList,
  seksiList,
  onCreate,
}: CreateWizardModalProps) {
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kodeAudit, setKodeAudit] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [jenisAudit, setJenisAudit] = useState<JenisAudit>('Internal');
  const [standar, setStandar] = useState<StandarAudit[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [customAreaName, setCustomAreaName] = useState('');

  useEffect(() => {
    if (open) {
      setStep(1);
      setError(null);
      setTanggalMulai('');
      setTanggalSelesai('');
      setJenisAudit('Internal');
      setStandar([]);
      setCustomAreaName('');

      const year = new Date().getFullYear();
      generateKodeAuditSchedule(year)
        .then(setKodeAudit)
        .catch(() => setKodeAudit(`IA-${year}-001`));

      setAreas(
        prosesList.map((p) => ({
          id: p.id,
          area: p.nama_proses,
          isCustom: false,
          selected: false,
          seksi_terkait: null,
          proses_terkait: [p.id],
          klausul_standar: [],
          dokumen_referensi: [],
          pic_area: null,
        })),
      );
    }
  }, [open, prosesList]);

  function validateStep1(): boolean {
    if (!tanggalMulai) {
      setError('Tanggal mulai wajib diisi');
      return false;
    }
    if (tanggalSelesai && tanggalSelesai < tanggalMulai) {
      setError('Tanggal selesai tidak boleh sebelum tanggal mulai');
      return false;
    }
    if (standar.length === 0) {
      setError('Minimal 1 standar wajib dipilih');
      return false;
    }
    setError(null);
    return true;
  }

  function validateStep2(): boolean {
    const selected = areas.filter((a) => a.selected);
    if (selected.length === 0) {
      setError('Minimal 1 area wajib dipilih');
      return false;
    }
    for (const a of selected) {
      if (!a.seksi_terkait) {
        setError(`Area "${a.area}" wajib assign Seksi Terkait`);
        return false;
      }
    }
    setError(null);
    return true;
  }

  function handleNext() {
    if (step === 1 && validateStep1()) setStep(2);
  }

  function handleBack() {
    setStep(1);
    setError(null);
  }

  function toggleAreaSelection(areaId: string) {
    setAreas((prev) =>
      prev.map((a) => (a.id === areaId ? { ...a, selected: !a.selected } : a)),
    );
  }

  function updateAreaSeksi(areaId: string, seksiId: string) {
    setAreas((prev) =>
      prev.map((a) => {
        if (a.id !== areaId) return a;
        const seksi = seksiList.find((s) => s.id === seksiId);
        return { ...a, seksi_terkait: seksiId, pic_area: getDefaultPicArea(seksi) };
      }),
    );
  }

  function updateAreaPic(areaId: string, pic: string) {
    setAreas((prev) =>
      prev.map((a) => (a.id === areaId ? { ...a, pic_area: pic || null } : a)),
    );
  }

  function addCustomArea() {
    const name = customAreaName.trim();
    if (!name) return;
    setAreas((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        area: name,
        isCustom: true,
        selected: true,
        seksi_terkait: null,
        proses_terkait: [],
        klausul_standar: [],
        dokumen_referensi: [],
        pic_area: null,
      },
    ]);
    setCustomAreaName('');
  }

  function removeCustomArea(areaId: string) {
    setAreas((prev) => prev.filter((a) => a.id !== areaId));
  }

  function toggleStandar(s: StandarAudit) {
    setStandar((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  async function handleSubmit() {
    if (!validateStep2()) return;
    setCreating(true);
    setError(null);
    try {
      const year = tanggalMulai
        ? new Date(tanggalMulai + 'T00:00:00').getFullYear()
        : new Date().getFullYear();

      const scopes: ScopeInput[] = areas
        .filter((a) => a.selected)
        .map((a) => ({
          area: a.area,
          seksi_terkait: a.seksi_terkait,
          proses_terkait: a.proses_terkait,
          klausul_standar: a.klausul_standar,
          dokumen_referensi: a.dokumen_referensi,
          pic_area: a.pic_area,
        }));

      await onCreate({
        tahun: year,
        tanggal_mulai: tanggalMulai || null,
        tanggal_selesai: tanggalSelesai || null,
        jenis_audit: jenisAudit,
        standar,
        scopes,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat jadwal audit');
    } finally {
      setCreating(false);
    }
  }

  const selectedAreas = areas.filter((a) => a.selected);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Buat Jadwal Audit Baru"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          {step === 2 && (
            <Button variant="secondary" onClick={handleBack}>
              <ChevronLeft size={16} /> Kembali
            </Button>
          )}
          {step === 1 ? (
            <Button onClick={handleNext}>
              Lanjut <ChevronRight size={16} />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={creating}>
              <Check size={16} /> {creating ? 'Memproses...' : 'Buat Jadwal'}
            </Button>
          )}
        </>
      }
    >
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
            1
          </div>
          <span className="text-sm font-medium">Detail Jadwal</span>
        </div>
        <div className={`flex-1 h-0.5 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
            2
          </div>
          <span className="text-sm font-medium">Ruang Lingkup</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Kode Audit">
            <div className="flex items-center gap-2">
              <Input value={kodeAudit} disabled />
              <AutoFilledBadge label="Auto-generate" />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tanggal Mulai" required>
              <Input
                type="date"
                value={tanggalMulai}
                onChange={(e) => setTanggalMulai(e.target.value)}
              />
            </Field>
            <Field label="Tanggal Selesai">
              <Input
                type="date"
                value={tanggalSelesai}
                onChange={(e) => setTanggalSelesai(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Jenis Audit" required>
            <Select
              value={jenisAudit}
              onChange={(e) => setJenisAudit(e.target.value as JenisAudit)}
            >
              {JENIS_AUDIT_LIST.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </Select>
          </Field>

          <Field label="Standar Acuan" required>
            <div className="flex items-center gap-4">
              {STANDAR_AUDIT_LIST.map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={standar.includes(s)}
                    onChange={() => toggleStandar(s)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{s}</span>
                </label>
              ))}
            </div>
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Pilih area yang akan diaudit dari master proses, atau tambah area kustom.
            Tiap area yang dicentang wajib memiliki Seksi Terkait & PIC Area.
          </p>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Tambah Area Kustom">
                <Input
                  value={customAreaName}
                  onChange={(e) => setCustomAreaName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomArea();
                    }
                  }}
                  placeholder="Ketik nama area lalu Enter"
                />
              </Field>
            </div>
            <Button variant="secondary" onClick={addCustomArea} disabled={!customAreaName.trim()}>
              <Plus size={14} /> Tambah
            </Button>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-10"></th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Area</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-48">Seksi Terkait</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-40">PIC Area</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {areas.map((a) => (
                  <tr key={a.id} className={a.selected ? 'bg-blue-50/50' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={a.selected}
                        onChange={() => toggleAreaSelection(a.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {a.area}
                      {a.isCustom && <Badge variant="blue">Kustom</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      {a.selected ? (
                        <Select
                          value={a.seksi_terkait ?? ''}
                          onChange={(e) => updateAreaSeksi(a.id, e.target.value)}
                        >
                          <option value="">— Pilih Seksi —</option>
                          {seksiList.map((s) => (
                            <option key={s.id} value={s.id}>{s.nama}</option>
                          ))}
                        </Select>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {a.selected ? (
                        <Input
                          value={a.pic_area ?? ''}
                          onChange={(e) => updateAreaPic(a.id, e.target.value)}
                          placeholder="Default: kepala seksi"
                          className="text-xs"
                        />
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {a.isCustom && (
                        <button
                          onClick={() => removeCustomArea(a.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title="Hapus area kustom"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <Badge variant={selectedAreas.length > 0 ? 'blue' : 'gray'}>
              {selectedAreas.length} area dipilih
            </Badge>
            {selectedAreas.some((a) => !a.seksi_terkait) && (
              <span className="text-amber-600">
                Ada area yang belum memiliki seksi terkait
              </span>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
