// Box Tujuan & Poin Perhatian untuk Program Internal Audit.
// Editable textareas saat Draft, read-only saat Approved.

import { Target, AlertCircle } from 'lucide-react';
import type { AuditProgram } from '../../../lib/types';
import { Card } from '../../ui';
import { Textarea } from '../../ui/Field';

interface TujuanPoinPerhatianProps {
  program: AuditProgram;
  readOnly: boolean;
  onFieldChange: (field: string, value: unknown) => void;
}

export function TujuanPoinPerhatian({ program, readOnly, onFieldChange }: TujuanPoinPerhatianProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="text-blue-600" size={18} />
          <h3 className="text-sm font-semibold text-gray-900">Tujuan</h3>
        </div>
        <Textarea
          value={program.tujuan ?? ''}
          disabled={readOnly}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            onFieldChange('tujuan', e.target.value)
          }
          placeholder="Tuliskan tujuan audit..."
          rows={5}
        />
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="text-amber-600" size={18} />
          <h3 className="text-sm font-semibold text-gray-900">Poin Perhatian</h3>
        </div>
        <Textarea
          value={program.poin_perhatian ?? ''}
          disabled={readOnly}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            onFieldChange('poin_perhatian', e.target.value)
          }
          placeholder="Tuliskan poin perhatian audit..."
          rows={5}
        />
      </Card>
    </div>
  );
}
