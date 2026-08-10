// Header approval panel untuk Program Internal Audit.
// Menampilkan: jenis ronde, nomor ke, tahun, tanggal, PJ QMS, management, kode dokumen, status.

import { FileCheck, UserCheck, User } from 'lucide-react';
import type { AuditProgram } from '../../../lib/types';
import { formatTanggal, toDateInput } from '../../../lib/utils';
import { PROGRAM_STATUS, JENIS_RONDE_LIST } from '../../../lib/enums';
import type { JenisRonde } from '../../../lib/enums';
import { Badge, Button } from '../../ui';
import { Field, Input, Select } from '../../ui/Field';

interface ProgramHeaderProps {
  program: AuditProgram;
  readOnly: boolean;
  onFieldChange: (field: string, value: unknown) => void;
  onApprove: () => void;
  onBack: () => void;
}

export function ProgramHeader({ program, readOnly, onFieldChange, onApprove, onBack }: ProgramHeaderProps) {
  const isApproved = program.status === PROGRAM_STATUS.APPROVED;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Kembali
          </button>
          <div className="flex items-center gap-2 ml-2">
            <FileCheck className="text-blue-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">Program Internal Audit</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={isApproved ? 'green' : 'amber'}>{program.status}</Badge>
          {!isApproved && (
            <Button size="sm" onClick={onApprove}>
              <UserCheck size={14} /> Approve
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Jenis Ronde" required>
          <Select
            value={program.jenis_ronde}
            disabled={readOnly}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              onFieldChange('jenis_ronde', e.target.value as JenisRonde)
            }
          >
            {JENIS_RONDE_LIST.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </Select>
        </Field>
        <Field label="Nomor Ke" required>
          <Input
            type="number"
            value={program.nomor_ke}
            disabled={readOnly}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onFieldChange('nomor_ke', parseInt(e.target.value) || 1)
            }
          />
        </Field>
        <Field label="Tahun" required>
          <Input
            type="number"
            value={program.tahun}
            disabled={readOnly}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onFieldChange('tahun', parseInt(e.target.value) || 0)
            }
          />
        </Field>
        <Field label="Kode Dokumen">
          <Input value={program.kode_dokumen} disabled />
        </Field>
        <Field label="Tanggal Dibuat" required>
          <Input
            type="date"
            value={toDateInput(program.tanggal_dibuat)}
            disabled={readOnly}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onFieldChange('tanggal_dibuat', e.target.value)
            }
          />
        </Field>
        <Field label="Tanggal Revisi">
          <Input
            type="date"
            value={toDateInput(program.tanggal_revisi)}
            disabled
          />
        </Field>
        <Field label="No. Revisi">
          <Input type="number" value={program.no_revisi} disabled />
        </Field>
        <Field label="Status">
          <Input value={program.status} disabled />
        </Field>
        <Field label="Penanggung Jawab QMS">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input
              className="pl-9"
              value={program.penanggung_jawab_qms ?? ''}
              disabled={readOnly}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onFieldChange('penanggung_jawab_qms', e.target.value)
              }
              placeholder="Nama PJ QMS"
            />
          </div>
        </Field>
        <Field label="Management">
          <Input
            value={program.management ?? ''}
            disabled={readOnly}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onFieldChange('management', e.target.value)
            }
            placeholder="Nama management"
          />
        </Field>
        <Field label="Tanggal Dibuat (record)">
          <Input value={formatTanggal(program.created_at)} disabled />
        </Field>
        <Field label="Terakhir Diperbarui">
          <Input value={formatTanggal(program.updated_at)} disabled />
        </Field>
      </div>
    </div>
  );
}
