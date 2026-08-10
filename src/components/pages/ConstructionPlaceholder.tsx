// Placeholder untuk modul yang sudah ada (Kalibrasi, Training) dan batch yang belum dibangun.
// Modul Kalibrasi & Training sudah ada di codebase lain — di sini hanya placeholder konsisten.

import { Wrench, GraduationCap, Clock } from 'lucide-react';
import type { PageId } from '../layout/Sidebar';

const pageConfig: Partial<Record<PageId, { icon: typeof Wrench; title: string; message: string }>> = {
  kalibrasi: {
    icon: Wrench,
    title: 'Modul Kalibrasi Alat Ukur',
    message: 'Modul ini sudah ada dan selesai. Akses melalui sidebar.',
  },
  training: {
    icon: GraduationCap,
    title: 'Modul Training & Kompetensi',
    message: 'Modul ini sudah ada dan selesai. Akses melalui sidebar.',
  },
};

interface ConstructionPlaceholderProps {
  pageId: PageId;
}

export function ConstructionPlaceholder({ pageId }: ConstructionPlaceholderProps) {
  const config = pageConfig[pageId];
  const Icon = config?.icon ?? Clock;
  const title = config?.title ?? 'Segera Hadir';
  const message = config?.message ?? 'Modul ini akan dibangun di batch berikutnya.';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
          <Icon className="text-blue-600" size={28} />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">{message}</p>
      </div>
    </div>
  );
}
