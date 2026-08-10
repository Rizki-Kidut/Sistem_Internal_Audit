// Header approval panel untuk Rencana Audit Tahunan.
// Menampilkan: Tahun, Tanggal Berlaku, No. Revisi, Kode Dokumen, PJ QMS, Disetujui Oleh, Status.

import { CalendarCheck, FileText, UserCheck, User } from 'lucide-react';
import type { AuditPlan } from '../../../lib/types';
import { formatTanggal, toDateInput } from '../../../lib/utils';
import { AUDIT_PLAN_STATUS } from '../../../lib/enums';
import { Badge, Button } from '../../ui';
import { Field, Input } from '../../ui/Field';

interface PlanHeaderProps {
  plan: AuditPlan;
  readOnly: boolean; // true jika status Approved
  onFieldChange: (field: string, value: unknown) => void;
  onApprove: () => void;
  onRevise: () => void;
}

export function PlanHeader({ plan, readOnly, onFieldChange, onApprove, onRevise }: PlanHeaderProps) {
  const isApproved = plan.status === AUDIT_PLAN_STATUS.APPROVED;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarCheck className="text-blue-600" size={20} />
          <h2 className="text-lg font-semibold text-gray-900">Header Rencana Audit</h2>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={isApproved ? 'green' : 'amber'}>
            {plan.status}
          </Badge>
          {isApproved ? (
            <Button variant="secondary" size="sm" onClick={onRevise}>
              <FileText size={14} /> Buat Revisi Baru
            </Button>
          ) : (
            <Button size="sm" onClick={onApprove}>
              <UserCheck size={14} /> Approve
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Tahun" required>
          <Input
            type="number"
            value={plan.tahun}
            disabled={readOnly}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('tahun', parseInt(e.target.value) || 0)}
          />
        </Field>
        <Field label="Tanggal Berlaku" required>
          <Input
            type="date"
            value={toDateInput(plan.tanggal_berlaku)}
            disabled={readOnly}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('tanggal_berlaku', e.target.value)}
          />
        </Field>
        <Field label="No. Revisi">
          <Input
            type="number"
            value={plan.no_revisi}
            disabled
          />
        </Field>
        <Field label="Kode Dokumen" required>
          <Input
            value={plan.kode_dokumen}
            disabled={readOnly}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('kode_dokumen', e.target.value)}
          />
        </Field>
        <Field label="Penanggung Jawab QMS">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input
              className="pl-9"
              value={plan.penanggung_jawab_qms ?? ''}
              disabled={readOnly}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('penanggung_jawab_qms', e.target.value)}
              placeholder="Nama PJ QMS"
            />
          </div>
        </Field>
        <Field label="Disetujui Oleh">
          <div className="relative">
            <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input
              className="pl-9"
              value={plan.disetujui_oleh ?? ''}
              disabled={readOnly || !isApproved}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('disetujui_oleh', e.target.value)}
              placeholder={isApproved ? 'Nama approver' : 'Diisi saat approve'}
            />
          </div>
        </Field>
        <Field label="Tanggal Dibuat">
          <Input value={formatTanggal(plan.created_at)} disabled />
        </Field>
        <Field label="Terakhir Diperbarui">
          <Input value={formatTanggal(plan.updated_at)} disabled />
        </Field>
      </div>
    </div>
  );
}
