// Header panel untuk Instruksi Internal Audit (detail view).

import { ArrowLeft } from 'lucide-react';
import type { AuditInstruction } from '../../../lib/types';
import { INSTRUCTION_STATUS_LIST } from '../../../lib/enums';
import type { InstructionStatus } from '../../../lib/enums';
import { toDateInput } from '../../../lib/utils';
import { Badge } from '../../ui';
import { Field, Input, Select, Textarea } from '../../ui/Field';

interface InstructionHeaderProps {
  instruction: AuditInstruction;
  rowCount: number;
  readOnly: boolean;
  onFieldChange: (field: string, value: unknown) => void;
  onBack: () => void;
}

const STATUS_BADGE: Record<string, 'gray' | 'green' | 'blue'> = {
  Draft: 'gray', Berjalan: 'blue', Selesai: 'green',
};

export function InstructionHeader({ instruction, rowCount, readOnly, onFieldChange, onBack }: InstructionHeaderProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="Kembali ke daftar">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Instruksi Internal Audit — FY {instruction.tahun_fiskal}</h2>
            <p className="text-xs text-gray-500">{instruction.kode_dokumen}</p>
          </div>
        </div>
        <Badge variant={STATUS_BADGE[instruction.status] ?? 'gray'}>{instruction.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Tahun Fiskal"><Input type="number" value={instruction.tahun_fiskal} disabled={readOnly} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('tahun_fiskal', parseInt(e.target.value) || 0)} /></Field>
        <Field label="No Revisi"><Input type="number" value={instruction.no_revisi} disabled={readOnly} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('no_revisi', parseInt(e.target.value) || 0)} /></Field>
        <Field label="Kode Dokumen"><Input value={instruction.kode_dokumen} disabled /></Field>
        <Field label="Prefix Nomor Audit"><Input value={instruction.prefix_nomor_audit} disabled={readOnly} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('prefix_nomor_audit', e.target.value)} /></Field>
        <Field label="Tanggal Buat"><Input type="date" value={toDateInput(instruction.tanggal_buat)} disabled={readOnly} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('tanggal_buat', e.target.value || null)} /></Field>
        <Field label="Tanggal Revisi"><Input type="date" value={toDateInput(instruction.tanggal_revisi)} disabled={readOnly} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('tanggal_revisi', e.target.value || null)} /></Field>
        <Field label="Status"><Select value={instruction.status} disabled={readOnly} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onFieldChange('status', e.target.value as InstructionStatus)}>{INSTRUCTION_STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
        <Field label="Jumlah Baris Audit"><Input value={`${rowCount} baris`} disabled /></Field>
        <Field label="Tujuan Audit" className="md:col-span-2"><Textarea value={instruction.tujuan_audit ?? ''} disabled={readOnly} rows={2} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onFieldChange('tujuan_audit', e.target.value)} placeholder="Tujuan pelaksanaan internal audit..." /></Field>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Approval</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Approval Pembuatan</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dibuat oleh (QMS)"><Input value={instruction.approval_pembuatan.dibuat_oleh_qms ?? ''} disabled={readOnly} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('approval_pembuatan', { ...instruction.approval_pembuatan, dibuat_oleh_qms: e.target.value || null })} /></Field>
              <Field label="Disetujui (Direktur)"><Input value={instruction.approval_pembuatan.disetujui_oleh_direktur ?? ''} disabled={readOnly} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('approval_pembuatan', { ...instruction.approval_pembuatan, disetujui_oleh_direktur: e.target.value || null })} /></Field>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Approval Selesai</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dibuat oleh (QMS)"><Input value={instruction.approval_selesai.dibuat_oleh_qms ?? ''} disabled={readOnly} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('approval_selesai', { ...instruction.approval_selesai, dibuat_oleh_qms: e.target.value || null })} /></Field>
              <Field label="Disetujui (Direktur)"><Input value={instruction.approval_selesai.disetujui_oleh_direktur ?? ''} disabled={readOnly} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFieldChange('approval_selesai', { ...instruction.approval_selesai, disetujui_oleh_direktur: e.target.value || null })} /></Field>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
