import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard, FileText, AlertCircle, ShieldAlert, Box,
  BarChart3, History, BellRing, Settings, UserCheck, FolderArchive,
  Receipt, FileDown, Building, GraduationCap
} from 'lucide-react';

export const Sidebar = ({ isOpen, closeSidebar }) => {
  const { currentRole, activePage, setActivePage, requests } = useApp();

  const pendingFinancialCount = requests.filter(r => r.type === 'financial' && r.status === 'Pending Approval').length;
  const escalatedCount = requests.filter(r => r.status === 'Escalated to SFSP Trust').length;
  const pendingIssueCount = requests.filter(r => r.type === 'non-financial' && r.status === 'In Review').length;

  const navGroups = {
    principal: [
      { title: 'Management', items: [
        { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
        { id: 'financial-requests', label: 'Financial Bills', icon: FileText, badge: pendingFinancialCount },
        { id: 'escalated-requests', label: 'Escalated (≥ ₹5L)', icon: ShieldAlert, badge: escalatedCount },
        { id: 'non-financial-requests', label: 'Faculty Issues', icon: AlertCircle, badge: pendingIssueCount },
      ]},
      { title: 'Campus', items: [
        { id: 'inventory', label: 'Inventory', icon: Box },
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
        { id: 'audit-history', label: 'Audit Log', icon: History },
      ]},
      { title: 'System', items: [
        { id: 'notifications', label: 'Notifications', icon: BellRing },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]},
    ],
    sfsp: [
      { title: 'Trust Board', items: [
        { id: 'sfsp-dashboard', label: 'Board Overview', icon: Building },
        { id: 'sfsp-review', label: 'Escalated Review', icon: ShieldAlert, badge: escalatedCount },
        { id: 'sfsp-decisions', label: 'Decisions Archive', icon: FolderArchive },
        { id: 'audit-history', label: 'Audit Log', icon: History },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
      ]},
    ],
    faculty: [
      { title: 'Faculty', items: [
        { id: 'faculty-dashboard', label: 'Dashboard', icon: GraduationCap },
        { id: 'faculty-requests', label: 'My Requests', icon: FileText },
        { id: 'faculty-profile', label: 'Documents & Profile', icon: UserCheck },
        { id: 'notifications', label: 'Notifications', icon: BellRing },
      ]},
    ],
    admin: [
      { title: 'Operations', items: [
        { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'inventory', label: 'Inventory', icon: Box },
        { id: 'purchase-bills', label: 'Purchase Bills', icon: Receipt },
        { id: 'exports', label: 'Exports & Reports', icon: FileDown },
        { id: 'settings', label: 'Preferences', icon: Settings },
      ]},
    ],
  };

  const groups = navGroups[currentRole] || navGroups.principal;

  return (
    <>
      {isOpen && <div onClick={closeSidebar} className="fixed inset-0 bg-gray-900/30 z-40 lg:hidden backdrop-blur-sm" />}

      <aside className={`fixed lg:static top-0 left-0 bottom-0 z-40 w-60 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Branding */}
        <div className="h-14 px-5 flex items-center gap-3 border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-extrabold text-xs shadow-sm">
            SP
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 tracking-tight leading-none">S.P. College</h2>
            <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase">Autonomous Portal</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-0.5">
              <h3 className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{group.title}</h3>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActivePage(item.id); if (window.innerWidth < 1024) closeSidebar(); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge > 0 && (
                      <span className={`min-w-[20px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100">
          <div className="px-3 py-2 rounded-lg bg-gray-50 flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <div>
              <p className="text-xs font-semibold text-gray-700 capitalize">{currentRole} View</p>
              <p className="text-[10px] text-gray-400">All features active</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
