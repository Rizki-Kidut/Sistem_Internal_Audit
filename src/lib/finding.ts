import type { Finding } from './types';

const filled = (value: string | null | undefined) => Boolean(value?.trim());
export function isFindingPLORComplete(finding: Pick<Finding, 'kategori'|'problem'|'location'|'objective_evidence'|'reference'|'saran_perbaikan'|'auditor_penemu_id'|'tanggal_temuan'>): boolean {
  return filled(finding.problem) && filled(finding.location) && filled(finding.objective_evidence)
    && filled(finding.reference) && Boolean(finding.auditor_penemu_id && finding.tanggal_temuan)
    && (finding.kategori !== 'C' || filled(finding.saran_perbaikan));
}
export function formatFindingNarrative(finding: Finding): string {
  if (!isFindingPLORComplete(finding)) return 'Lengkapi data PLOR untuk menampilkan narasi.';
  const base = `Pada ${finding.location!.trim()}, ditemukan ${finding.problem!.trim()}. Hal ini dibuktikan dengan ${finding.objective_evidence!.trim()}, yang tidak sesuai dengan ${finding.reference!.trim()}.`;
  return finding.kategori === 'C' ? `${base} Saran perbaikan: ${finding.saran_perbaikan!.trim()}.` : base;
}
