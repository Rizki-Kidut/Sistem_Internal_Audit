// Tabel Risiko & Peluang untuk Program Internal Audit.
// Tambah/hapus baris bebas, inline edit.

import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import type { AuditProgramRisiko } from '../../../lib/types';
import { Card } from '../../ui';
import { Input, Textarea } from '../../ui/Field';

interface RisikoTableProps {
  risiko: AuditProgramRisiko[];
  readOnly: boolean;
  onAdd: () => void;
  onUpdate: (id: string, field: keyof AuditProgramRisiko, value: string) => void;
  onDelete: (id: string) => void;
}

export function RisikoTable({ risiko, readOnly, onAdd, onUpdate, onDelete }: RisikoTableProps) {
  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-amber-600" size={18} />
          <h3 className="text-sm font-semibold text-gray-900">Risiko & Peluang</h3>
        </div>
        {!readOnly && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} /> Tambah Baris
          </button>
        )}
      </div>

      {risiko.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          Belum ada risiko/peluang. Klik "Tambah Baris" untuk menambah.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                  No
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Risiko / Peluang
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Control Action
                </th>
                {!readOnly && (
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {risiko.map((r, idx) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Input
                      value={r.nomor ?? ''}
                      disabled={readOnly}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onUpdate(r.id, 'nomor', e.target.value)
                      }
                      placeholder={String(idx + 1)}
                      className="text-sm text-center"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Textarea
                      value={r.risiko_peluang ?? ''}
                      disabled={readOnly}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        onUpdate(r.id, 'risiko_peluang', e.target.value)
                      }
                      placeholder="Deskripsi risiko/peluang..."
                      rows={2}
                      className="text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Textarea
                      value={r.control_action ?? ''}
                      disabled={readOnly}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        onUpdate(r.id, 'control_action', e.target.value)
                      }
                      placeholder="Control action..."
                      rows={2}
                      className="text-sm"
                    />
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => onDelete(r.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Hapus baris"
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
    </Card>
  );
}
