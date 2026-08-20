// Tabel Schedule Dasar (7 langkah) dengan rentang Tanggal Awal/Tanggal Akhir.
// Bisa tambah/hapus baris dan drag-and-drop urutan.

import { GripVertical, Plus, Trash2, ListChecks } from 'lucide-react';
import type { AuditProgramStep } from '../../../lib/types';
import { Card } from '../../ui';
import { Input, Textarea } from '../../ui/Field';

interface StepsTableProps {
  steps: AuditProgramStep[];
  readOnly: boolean;
  onUpdateField: (stepId: string, field: keyof AuditProgramStep, value: string) => void;
  onAdd: () => void;
  onDelete: (stepId: string) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function StepsTable({
  steps,
  readOnly,
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
                <th className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                  No
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Item Pelaksanaan
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Prosedur Pelaksanaan
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[150px]">Tanggal Awal</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[150px]">Tanggal Akhir</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  PIC
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {steps.map((step, idx) => (
                <tr key={step.id} className="hover:bg-gray-50 group">
                  <td
                    className="align-middle px-2 py-2 text-center cursor-grab active:cursor-grabbing"
                    draggable={!readOnly}
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                  >
                    <span className="inline-flex items-center justify-center gap-1 text-sm text-gray-500">
                      {!readOnly && <GripVertical className="text-gray-300 group-hover:text-gray-400" size={14} />}
                      {step.nomor}
                    </span>
                  </td>
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
                  <td className="px-3 py-2">
                    <Input type="date" value={step.tanggal_awal ?? ''} disabled={readOnly}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdateField(step.id, 'tanggal_awal', e.target.value)} />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="date" value={step.tanggal_akhir ?? ''} min={step.tanggal_awal ?? undefined} disabled={readOnly}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdateField(step.id, 'tanggal_akhir', e.target.value)} />
                  </td>
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
                  <td className="px-2 py-2 text-center">
                    {!readOnly && (
                      <button
                        onClick={() => onDelete(step.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Hapus langkah"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </Card>
  );
}
