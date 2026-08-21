import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';

import { Login } from './pages/Login';
import { PrincipalDashboard } from './pages/PrincipalDashboard';
import { FinancialRequestsManagement } from './pages/FinancialRequestsManagement';
import { EscalatedRequestsManagement } from './pages/EscalatedRequestsManagement';
import { NonFinancialRequestsManagement } from './pages/NonFinancialRequestsManagement';
import { SFSPDashboard } from './pages/SFSPDashboard';
import { SFSPDecisionsArchive } from './pages/SFSPDecisionsArchive';
import { AuditHistory } from './pages/AuditHistory';
import { FacultyDashboard } from './pages/FacultyDashboard';
import { FacultyMyRequests } from './pages/FacultyMyRequests';
import { FacultyDocumentsProfile } from './pages/FacultyDocumentsProfile';
import { AdminClerkDashboard } from './pages/AdminClerkDashboard';
import { InventoryManagement } from './pages/InventoryManagement';
import { PurchaseBills } from './pages/PurchaseBills';
import { DataExports } from './pages/DataExports';
import { ReportsAnalytics } from './pages/ReportsAnalytics';
import { NotificationsCenter } from './pages/NotificationsCenter';
import { SettingsPreferences } from './pages/SettingsPreferences';

const PageRenderer = () => {
  const { activePage } = useApp();

  if (activePage === 'login') {
    return <Login />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <PrincipalDashboard />;
      case 'financial-requests':
        return <FinancialRequestsManagement />;
      case 'escalated-requests':
      case 'sfsp-review':
        return <EscalatedRequestsManagement />;
      case 'non-financial-requests':
        return <NonFinancialRequestsManagement />;
      case 'sfsp-dashboard':
        return <SFSPDashboard />;
      case 'sfsp-decisions':
        return <SFSPDecisionsArchive />;
      case 'audit-history':
        return <AuditHistory />;
      case 'faculty-dashboard':
        return <FacultyDashboard />;
      case 'faculty-requests':
        return <FacultyMyRequests />;
      case 'faculty-profile':
        return <FacultyDocumentsProfile />;
      case 'admin-dashboard':
        return <AdminClerkDashboard />;
      case 'inventory':
        return <InventoryManagement />;
      case 'purchase-bills':
        return <PurchaseBills />;
      case 'exports':
        return <DataExports />;
      case 'reports':
        return <ReportsAnalytics />;
      case 'notifications':
        return <NotificationsCenter />;
      case 'settings':
        return <SettingsPreferences />;
      default:
        return <PrincipalDashboard />;
    }
  };

  return <AppShell>{renderPage()}</AppShell>;
};

export default function App() {
  return (
    <AppProvider>
      <PageRenderer />
    </AppProvider>
  );
}
