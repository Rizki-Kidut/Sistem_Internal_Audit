// Header panel untuk Detail Sesi Audit.
// Menampilkan: Kode Audit, tanggal mulai/selesai, jenis, standar, status, approvedBy.
// Tombol "Schedule" memicu validasi: tidak bisa Scheduled tanpa minimal 1 area+seksi.

import { CalendarCheck, UserCheck, User } from 'lucide-react';
import type { AuditSchedule } from '../../../lib/types';
import {
  AUDIT_SCHEDULE_STATUS_LIST,
  JENIS_AUDIT_LIST,
  STANDAR_AUDIT_LIST,
} from '../../../lib/enums';
import type { JenisAudit, StandarAudit } from '../../../lib/enums';
import { toDateInput } from '../../../lib/utils';
import { Badge, Button } from '../../ui';
import { Field, Input, Select } from '../../ui/Field';

interface ScheduleHeaderProps {
  schedule: AuditSchedule;
  readOnly: boolean;
  scopeCount: number;
  onFieldChange: (field: string, value: unknown) => void;
  onSchedule: () => void;
  onBack: () => void;
}

const STATUS_BADGE: Record<string, 'gray' | 'green' | 'blue' | 'amber'> = {
  Draft: 'amber',
  Scheduled: 'blue',
  'In Progress': 'blue',
  Completed: 'green',
  Closed: 'gray',
};

export function ScheduleHeader({
  schedule,
  readOnly,
  scopeCount,
  onFieldChange,
  onSchedule,
  onBack,
}: ScheduleHeaderProps) {
  const isScheduled = schedule.status !== 'Draft';

  function toggleStandar(s: StandarAudit) {
    const current = schedule.standar ?? [];
    const next = current.includes(s)
      ? current.filter((x) => x !== s)
      : [...current, s];
    onFieldChange('standar', next);
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Kembali ke daftar"
          >
            <CalendarCheck size={20} />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {schedule.kode_audit}
            </h2>
            <p className="text-xs text-gray-500">Detail Sesi Audit</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={STATUS_BADGE[schedule.status] ?? 'amber'}>
            {schedule.status}
          </Badge>
          {!isScheduled && (
            <Button size="sm" onClick={onSchedule}>
              <UserCheck size={14} /> Schedule
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Kode Audit">
          <Input value={schedule.kode_audit} disabled />
        </Field>
        <Field label="Tanggal Mulai">
          <Input
            type="date"
            value={toDateInput(schedule.tanggal_mulai)}
            disabled={readOnly}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('tanggal_mulai', e.target.value || null)}
          />
        </Field>
        <Field label="Tanggal Selesai">
          <Input
            type="date"
            value={toDateInput(schedule.tanggal_selesai)}
            disabled={readOnly}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('tanggal_selesai', e.target.value || null)}
          />
        </Field>
        <Field label="Jenis Audit">
          <Select
            value={schedule.jenis_audit}
            disabled={readOnly}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onFieldChange('jenis_audit', e.target.value as JenisAudit)}
          >
            {JENIS_AUDIT_LIST.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </Select>
        </Field>

        <Field label="Standar Acuan">
          <div className="flex items-center gap-4 pt-2">
            {STANDAR_AUDIT_LIST.map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={schedule.standar?.includes(s) ?? false}
                  disabled={readOnly}
                  onChange={() => toggleStandar(s)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{s}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Status">
          <Select value={schedule.status} disabled>
            {AUDIT_SCHEDULE_STATUS_LIST.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>

        <Field label="Disetujui Oleh">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input
              className="pl-9"
              value={schedule.approved_by ?? ''}
              disabled={readOnly}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('approved_by', e.target.value)}
              placeholder="Nama approver"
            />
          </div>
        </Field>

        <Field label="Jumlah Ruang Lingkup">
          <Input value={`${scopeCount} area`} disabled />
        </Field>
      </div>
    </div>
  );
}
