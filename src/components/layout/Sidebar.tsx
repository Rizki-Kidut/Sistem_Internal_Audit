import { type ReactNode } from 'react';
import { ClipboardList, CalendarCheck, ListChecks, Users, FileCheck, ClipboardCheck, TriangleAlert as AlertTriangle, FileText, ChartBar as BarChart3, Settings, Wrench, GraduationCap, Workflow, Factory, LogOut } from 'lucide-react';
import type { UserProfile } from '../../lib/auth';
import { allowedPages } from '../../lib/auth';

export type PageId =
  | 'kalibrasi'
  | 'training'
  | 'rencana-audit'
  | 'program-audit'
  | 'instruksi-audit'
  | 'plant-admin'
  | 'checklist'
  | 'agenda'
  | 'pelaksanaan'
  | 'temuan'
  | 'car'
  | 'ketidaksesuaian'
  | 'laporan'
  | 'analisa'
  | 'seksi'
  | 'proses'
  | 'bank-checklist'
  | 'team-master';

interface NavItem {
  id: PageId;
  label: string;
  icon: ReactNode;
  group?: string;
  disabled?: boolean;
}

// Struktur menu — modul yang sudah ada + modul baru (batch bertahap).
// Item yang belum dibangun ditandai disabled.
const navItems: NavItem[] = [
  // Modul yang sudah ada
  { id: 'kalibrasi', label: 'Kalibrasi Alat Ukur', icon: <Wrench size={18} />, group: 'Modul Eksisting' },
  { id: 'training', label: 'Training & Kompetensi', icon: <GraduationCap size={18} />, group: 'Modul Eksisting' },

  // Modul baru: Pelaksanaan Internal Audit
  { id: 'rencana-audit', label: 'Rencana Audit Tahunan', icon: <CalendarCheck size={18} />, group: 'Pelaksanaan Internal Audit' },
  { id: 'bank-checklist', label: 'Bank Checklist', icon: <ListChecks size={18} />, group: 'Pelaksanaan Internal Audit' },
  { id: 'program-audit', label: 'Program Internal Audit', icon: <ClipboardList size={18} />, group: 'Pelaksanaan Internal Audit' },
  { id: 'instruksi-audit', label: 'Instruksi Internal Audit', icon: <FileCheck size={18} />, group: 'Pelaksanaan Internal Audit' },
  { id: 'checklist', label: 'Checklist Audit', icon: <ClipboardCheck size={18} />, group: 'Pelaksanaan Internal Audit' },
  { id: 'agenda', label: 'Agenda Internal Audit', icon: <ClipboardList size={18} />, group: 'Pelaksanaan Internal Audit' },
  { id: 'pelaksanaan', label: 'Pelaksanaan Audit', icon: <ClipboardCheck size={18} />, group: 'Pelaksanaan Internal Audit' },
  { id: 'temuan', label: 'Temuan (PLOR)', icon: <AlertTriangle size={18} />, group: 'Pelaksanaan Internal Audit' },
  { id: 'car', label: 'CAR Tracker', icon: <AlertTriangle size={18} />, group: 'Pelaksanaan Internal Audit', disabled: true },
  { id: 'ketidaksesuaian', label: 'Daftar Ketidaksesuaian', icon: <FileText size={18} />, group: 'Pelaksanaan Internal Audit', disabled: true },
  { id: 'laporan', label: 'Laporan Internal Audit', icon: <FileText size={18} />, group: 'Pelaksanaan Internal Audit', disabled: true },
  { id: 'analisa', label: 'Analisa Weakness Point', icon: <BarChart3 size={18} />, group: 'Pelaksanaan Internal Audit', disabled: true },

  // Master data
  { id: 'seksi', label: 'Kelola Seksi', icon: <Settings size={18} />, group: 'Master Data' },
  { id: 'proses', label: 'Kelola Proses', icon: <Workflow size={18} />, group: 'Master Data' },
  { id: 'team-master', label: 'Kelola Tim Audit', icon: <Users size={18} />, group: 'Master Data' },
  { id: 'plant-admin', label: 'Plant, Model & Shift', icon: <Factory size={18} />, group: 'Master Data' },
];

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  profile: UserProfile;
  onLogout: () => void;
}

export function Sidebar({ currentPage, onNavigate, profile, onLogout }: SidebarProps) {
  // Kelompokkan item berdasarkan group
  const groups: { group: string; items: NavItem[] }[] = [];
  const visiblePages = allowedPages(profile.identity_type);
  for (const item of navItems.filter(item => visiblePages.includes(item.id))) {
    const groupName = item.group ?? 'Lainnya';
    let g = groups.find((g) => g.group === groupName);
    if (!g) {
      g = { group: groupName, items: [] };
      groups.push(g);
    }
    g.items.push(item);
  }

  return (
    <aside className="w-64 bg-blue-800 text-white flex flex-col min-h-screen flex-shrink-0">
      {/* Logo / Brand */}
      <div className="px-6 py-5 border-b border-blue-700">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
            <FileCheck className="text-blue-800" size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">CertiTrack</h1>
            <p className="text-xs text-blue-200">QMS Management System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {groups.map((g) => (
          <div key={g.group} className="mb-4">
            <p className="px-6 mb-2 text-xs font-semibold uppercase tracking-wider text-blue-300">
              {g.group}
            </p>
            {g.items.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && onNavigate(item.id)}
                  disabled={item.disabled}
                  className={`w-full flex items-center gap-3 px-6 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-900 text-white font-medium border-l-4 border-white'
                      : item.disabled
                        ? 'text-blue-400 cursor-not-allowed'
                        : 'text-blue-100 hover:bg-blue-700'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.disabled && (
                    <span className="ml-auto text-xs text-blue-400">Soon</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-blue-700 text-xs text-blue-200">
        <p className="font-semibold text-white truncate">{profile.display_name}</p>
        <p className="mt-1">{profile.identity_type}</p>
        <button onClick={onLogout} className="mt-3 flex items-center gap-2 text-blue-100 hover:text-white"><LogOut size={14}/> Logout</button>
      </div>
    </aside>
  );
}
