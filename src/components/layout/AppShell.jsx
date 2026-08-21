import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Toast } from '../ui/Toast';
import { RequestDetailModal } from '../modals/RequestDetailModal';
import { NewFinancialRequestModal } from '../modals/NewFinancialRequestModal';
import { NewIssueModal } from '../modals/NewIssueModal';
import { InventoryModal } from '../modals/InventoryModal';
import { ExportModal } from '../modals/ExportModal';

export const AppShell = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} closeSidebar={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-5 md:p-6 lg:p-8 space-y-6">
          {children}
        </main>
      </div>
      <RequestDetailModal />
      <NewFinancialRequestModal />
      <NewIssueModal />
      <InventoryModal />
      <ExportModal />
      <Toast />
    </div>
  );
};
