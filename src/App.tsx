import { useEffect, useState } from 'react';
import { Sidebar, type PageId } from './components/layout/Sidebar';
import { RencanaAuditPage } from './components/pages/RencanaAuditPage';
import { ProgramAuditPage } from './components/pages/ProgramAuditPage';
import { BankChecklistPage } from './components/pages/BankChecklistPage';
import { SeksiPage } from './components/pages/SeksiPage';
import { ProsesPage } from './components/pages/ProsesPage';
import { InstruksiAuditPage } from './components/pages/InstruksiAuditPage';
import { PlantAdminPage } from './components/pages/PlantAdminPage';
import { ConstructionPlaceholder } from './components/pages/ConstructionPlaceholder';
import { AuditTeamMasterPage } from './components/pages/AuditTeamMasterPage';
import { ChecklistAuditPage } from './components/pages/ChecklistAuditPage';
import { AgendaAuditPage } from './components/pages/AgendaAuditPage';
import { TemuanPage } from './components/pages/TemuanPage';
import { PelaksanaanAuditPage } from './components/pages/PelaksanaanAuditPage';
import { LtpPage } from './components/pages/LtpPage';
import { UserManagementPage } from './components/pages/UserManagementPage';
import { DaftarKetidaksesuaianPage } from './components/pages/DaftarKetidaksesuaianPage';
import { LaporanInternalAuditPage } from './components/pages/LaporanInternalAuditPage';
import { useAuth } from './contexts/AuthContext';
import { canAccessPage, landingPage } from './lib/auth';
import { LoginPage } from './components/pages/LoginPage';
import { LoadingSpinner, Button } from './components/ui';

function App() {
  const {session,profile,loading,profileError,logout}=useAuth();
  const [currentPage, setCurrentPage] = useState<PageId>('rencana-audit');
  // State untuk navigasi cross-page: ketika "Buat Program Internal Audit" diklik
  // di RencanaAuditPage, kita navigasi ke ProgramAuditPage dengan programId ter-prefill
  const [initialProgramId, setInitialProgramId] = useState<string | null>(null);
  useEffect(()=>{if(profile){const landing=landingPage(profile.identity_type);if(landing&&!canAccessPage(profile.identity_type,currentPage))setCurrentPage(landing);}},[profile,currentPage]);

  if(loading)return <div className="min-h-screen flex items-center justify-center bg-gray-100"><LoadingSpinner message="Memulihkan sesi CertiTrack..."/></div>;
  if(!session)return <LoginPage/>;
  if(!profile)return <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6"><div className="bg-white rounded-xl shadow p-8 text-center max-w-md"><h1 className="text-xl font-bold text-gray-900">Akses CertiTrack</h1><p className="mt-3 text-gray-600">{profileError??'Akun belum dikonfigurasi untuk CertiTrack.'}</p><Button className="mt-6" onClick={()=>void logout()}>Logout</Button></div></div>;
  const identityType=profile.identity_type;
  const landing=landingPage(identityType);
  if(!landing)return null;

  function handleNavigateToProgram(programId: string) {
    setInitialProgramId(programId);
    setCurrentPage('program-audit');
  }

  function renderPage() {
    switch (currentPage) {
      case 'rencana-audit':
        return <RencanaAuditPage onNavigateToProgram={handleNavigateToProgram} />;
      case 'program-audit':
        return (
          <ProgramAuditPage
            initialProgramId={initialProgramId}
            onClearInitial={() => setInitialProgramId(null)}
          />
        );
      case 'bank-checklist':
        return <BankChecklistPage />;
      case 'seksi':
        return <SeksiPage />;
      case 'proses':
        return <ProsesPage />;
      case 'instruksi-audit':
        return <InstruksiAuditPage />;
      case 'checklist':
        return <ChecklistAuditPage readOnly={identityType !== 'ADMIN'} />;
      case 'agenda':
        return <AgendaAuditPage readOnly={identityType !== 'ADMIN'} />;
      case 'pelaksanaan':
        return <PelaksanaanAuditPage />;
      case 'temuan':
        return <TemuanPage />;
      case 'car':
        return <LtpPage />;
      case 'ketidaksesuaian':
        return <DaftarKetidaksesuaianPage />;
      case 'laporan':
        return <LaporanInternalAuditPage />;
      case 'team-master':
        return <AuditTeamMasterPage />;
      case 'plant-admin':
        return <PlantAdminPage />;
      case 'user-management':
        return <UserManagementPage />;
      case 'kalibrasi':
      case 'training':
        return <ConstructionPlaceholder pageId={currentPage} />;
      default:
        return <ConstructionPlaceholder pageId={currentPage} />;
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} profile={profile} onLogout={()=>void logout()} />
      <main className="flex-1 overflow-x-auto">
        <div className="p-6 max-w-[1600px] mx-auto">
          {canAccessPage(identityType,currentPage)?renderPage():<div className="bg-white rounded-xl shadow p-8"><h1 className="text-xl font-bold">Akses ditolak</h1><p className="mt-2 text-gray-500">Identitas ini tidak memiliki izin untuk membuka halaman tersebut.</p></div>}
        </div>
      </main>
    </div>
  );
}

export default App;
