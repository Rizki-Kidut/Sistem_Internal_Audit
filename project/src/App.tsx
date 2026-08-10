import { useState } from 'react';
import { Sidebar, type PageId } from './components/layout/Sidebar';
import { RencanaAuditPage } from './components/pages/RencanaAuditPage';
import { ProgramAuditPage } from './components/pages/ProgramAuditPage';
import { BankChecklistPage } from './components/pages/BankChecklistPage';
import { SeksiPage } from './components/pages/SeksiPage';
import { ProsesPage } from './components/pages/ProsesPage';
import { ConstructionPlaceholder } from './components/pages/ConstructionPlaceholder';

function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('rencana-audit');
  // State untuk navigasi cross-page: ketika "Buat Program Internal Audit" diklik
  // di RencanaAuditPage, kita navigasi ke ProgramAuditPage dengan programId ter-prefill
  const [initialProgramId, setInitialProgramId] = useState<string | null>(null);

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
      case 'kalibrasi':
      case 'training':
        return <ConstructionPlaceholder pageId={currentPage} />;
      default:
        return <ConstructionPlaceholder pageId={currentPage} />;
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-x-auto">
        <div className="p-6 max-w-[1600px] mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
