// Tabel Tujuan Distribusi untuk Program Internal Audit.
// Checkbox seksi + nama_section_manager auto-terisi dari seksi.kepala_seksi, overrideable.

import { Users } from 'lucide-react';
import type { AuditProgramDistribusi, Seksi } from '../../../lib/types';
import { Card, Badge } from '../../ui';
import { Input } from '../../ui/Field';

interface DistribusiTableProps {
  seksiList: Seksi[];
  distribusi: AuditProgramDistribusi[];
  readOnly: boolean;
  onToggleSeksi: (seksiId: string, seksi: Seksi) => void;
  onUpdateManager: (distribusiId: string, nama: string) => void;
}

// Selector/computed: cari distribusi untuk seksi tertentu
function findDistribusi(distribusi: AuditProgramDistribusi[], seksiId: string): AuditProgramDistribusi | undefined {
  return distribusi.find((d) => d.seksi_id === seksiId);
}

// Selector/computed: cek apakah nama manager saat ini cocok dengan default (auto-terisi)
function isAutoFilled(d: AuditProgramDistribusi | undefined, seksi: Seksi): boolean {
  if (!d?.nama_section_manager) return false;
  return d.nama_section_manager === seksi.kepala_seksi;
}

export function DistribusiTable({
  seksiList,
  distribusi,
  readOnly,
  onToggleSeksi,
  onUpdateManager,
}: DistribusiTableProps) {
  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="text-blue-600" size={18} />
        <h3 className="text-sm font-semibold text-gray-900">Tujuan Distribusi</h3>
        <Badge variant="blue">{distribusi.length} seksi</Badge>
      </div>

      {seksiList.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          Belum ada seksi aktif. Tambahkan seksi di menu "Kelola Seksi" terlebih dahulu.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                  Pilih
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Seksi
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Section Manager
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {seksiList.map((s) => {
                const d = findDistribusi(distribusi, s.id);
                const checked = !!d;
                const autoFilled = isAutoFilled(d, s);
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={readOnly}
                        onChange={() => onToggleSeksi(s.id, s)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">{s.nama}</td>
                    <td className="px-3 py-2">
                      {checked ? (
                        <Input
                          value={d?.nama_section_manager ?? ''}
                          disabled={readOnly}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            d && onUpdateManager(d.id, e.target.value)
                          }
                          placeholder="Nama section manager"
                          className="text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {checked && autoFilled && (
                        <Badge variant="blue">Auto</Badge>
                      )}
                      {checked && !autoFilled && (
                        <Badge variant="gray">Manual</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        Nama section manager auto-terisi dari kepala seksi saat dicentang. Bisa di-override manual.
      </p>
    </Card>
  );
}
