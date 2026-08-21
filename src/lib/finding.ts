import type { Finding } from './types';

const filled = (value: string | null | undefined) => Boolean(value?.trim());
export function isFindingPLORComplete(finding: Pick<Finding, 'kategori'|'problem'|'location'|'objective_evidence'|'reference'|'saran_perbaikan'|'auditor_penemu_id'|'tanggal_temuan'>): boolean {
  const commonFieldsComplete = filled(finding.problem) && filled(finding.location)
    && filled(finding.objective_evidence) && Boolean(finding.auditor_penemu_id && finding.tanggal_temuan);
  return commonFieldsComplete && (finding.kategori === 'C'
    ? filled(finding.saran_perbaikan)
    : filled(finding.reference));
}
export function formatFindingNarrative(finding: Finding): string {
  const narrativeFieldsComplete = filled(finding.problem) && filled(finding.location)
    && filled(finding.objective_evidence) && (finding.kategori === 'C'
      ? filled(finding.saran_perbaikan)
      : filled(finding.reference));
  if (!narrativeFieldsComplete) return 'Lengkapi data PLOR untuk menampilkan narasi.';
  if (finding.kategori === 'C') {
    const base = `Pada ${finding.location!.trim()}, terdapat peluang peningkatan terkait ${finding.problem!.trim()}. Berdasarkan ${finding.objective_evidence!.trim()}, disarankan ${finding.saran_perbaikan!.trim()}.`;
    return filled(finding.reference)
      ? `${base} Sebagai acuan, hal ini berkaitan dengan ${finding.reference!.trim()}.`
      : base;
  }
  return `Pada ${finding.location!.trim()}, ditemukan ${finding.problem!.trim()}. Hal ini dibuktikan dengan ${finding.objective_evidence!.trim()}, yang tidak sesuai dengan ${finding.reference!.trim()}.`;
}
