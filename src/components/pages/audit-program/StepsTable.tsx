// Tabel Schedule Dasar (7 langkah) dengan kolom periode dinamis sesuai periode_label program.
// Bukan 4 kolom kaku — jumlah kolom mengikuti panjang periode_label.
// Bisa tambah/hapus baris, toggle periode_target via klik sel, drag-and-drop urutan.

import { GripVertical, Plus, Trash2, ListChecks } from 'lucide-react';
import type { AuditProgramStep } from '../../../lib/types';
import { Card } from '../../ui';
import { Input, Textarea } from '../../ui/Field';

interface StepsTableProps {
  steps: AuditProgramStep[];
  periodeLabel: string[];
  readOnly: boolean;
  onTogglePeriode: (stepId: string, periodeIndex: number, currentValue: boolean[]) => void;
  onUpdateField: (stepId: string, field: keyof AuditProgramStep, value: string) => void;
  onAdd: () => void;
  onDelete: (stepId: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function StepsTable({
  steps,
  periodeLabel,
  readOnly,
  onTogglePeriode,
  onUpdateField,
  onAdd,
  onDelete,
  onReorder,
}: StepsTableProps) {
  let dragIndex: number | null = null;

  function handleDragStart(idx: number) {
    dragIndex = idx;
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(targetIdx: number) {
    if (dragIndex === null || dragIndex === targetIdx) return;
    const reordered = [...steps];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIdx, 0, moved);
    onReorder(reordered.map((s) => s.id));
    dragIndex = null;
  }

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ListChecks className="text-blue-600" size={18} />
          <h3 className="text-sm font-semibold text-gray-900">Schedule Dasar</h3>
          <span className="text-xs text-gray-400">({periodeLabel.length} periode)</span>
        </div>
        {!readOnly && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} /> Tambah Langkah
          </button>
        )}
      </div>

      {steps.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          Belum ada langkah. Klik "Tambah Langkah" untuk menambah.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">
                  No
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Item Pelaksanaan
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Prosedur Pelaksanaan
                </th>
                {periodeLabel.map((label, pIdx) => (
                  <th
                    key={pIdx}
                    className="px-1 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    style={{ minWidth: 70 }}
                  >
                    {label}
                  </th>
                ))}
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  PIC
                </th>
                {!readOnly && (
                  <th className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {steps.map((step, idx) => (
                <tr key={step.id} className="hover:bg-gray-50 group">
                  <td
                    className="align-middle px-1 py-2 text-center cursor-grab active:cursor-grabbing"
                    draggable={!readOnly}
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                  >
                    {!readOnly && <GripVertical className="text-gray-300 group-hover:text-gray-400 inline" size={14} />}
                  </td>
                  <td className="px-2 py-2 text-center text-sm text-gray-500">{step.nomor}</td>
                  <td className="px-3 py-2">
                    <Input
                      value={step.item_pelaksanaan ?? ''}
                      disabled={readOnly}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onUpdateField(step.id, 'item_pelaksanaan', e.target.value)
                      }
                      placeholder="Item pelaksanaan..."
                      className="text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Textarea
                      value={step.prosedur_pelaksanaan ?? ''}
                      disabled={readOnly}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        onUpdateField(step.id, 'prosedur_pelaksanaan', e.target.value)
                      }
                      placeholder="Prosedur pelaksanaan..."
                      rows={2}
                      className="text-sm"
                    />
                  </td>
                  {periodeLabel.map((_, pIdx) => {
                    const isChecked = step.periode_target?.[pIdx] ?? false;
                    return (
                      <td key={pIdx} className="px-1 py-2 text-center">
                        <button
                          disabled={readOnly}
                          onClick={() => onTogglePeriode(step.id, pIdx, step.periode_target ?? [])}
                          className={`w-6 h-6 rounded transition-all ${
                            isChecked
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-50 hover:bg-blue-100'
                          } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                          title={isChecked ? 'Aktif (klik untuk hapus)' : 'Tidak aktif (klik untuk set)'}
                        >
                          {isChecked ? '■' : ''}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2">
                    <Input
                      value={step.pic ?? ''}
                      disabled={readOnly}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onUpdateField(step.id, 'pic', e.target.value)
                      }
                      placeholder="PIC..."
                      className="text-sm"
                    />
                  </td>
                  {!readOnly && (
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => onDelete(step.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Hapus langkah"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-blue-500"></span> Periode aktif
        </span>
        <span className="text-gray-400">Klik sel untuk toggle periode. Drag handle untuk urutan.</span>
      </div>
    </Card>
  );
}
