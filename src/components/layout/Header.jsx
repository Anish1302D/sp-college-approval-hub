import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { RoleSwitcher } from './RoleSwitcher';
import { Search, Bell, Plus, Download, Menu } from 'lucide-react';

export const Header = ({ toggleSidebar }) => {
  const {
    currentRole, notifications, markNotificationRead,
    searchQuery, setSearchQuery,
    setIsNewFinancialModalOpen, setIsNewIssueModalOpen,
    setIsExportModalOpen, setActivePage
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center justify-between gap-4">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 lg:hidden">
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block">
          <h1 className="text-sm font-bold text-gray-900">S.P. College Portal</h1>
          <p className="text-[11px] text-gray-400">Approval &amp; Workflow Management</p>
        </div>
      </div>

      {/* Center */}
      <div className="flex items-center gap-3 flex-1 max-w-2xl justify-center">
        <div className="relative w-full max-w-xs hidden md:block">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search bills, items, faculty..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <RoleSwitcher />
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {currentRole === 'faculty' && (
          <div className="flex items-center gap-2">
            <button onClick={() => setIsNewFinancialModalOpen(true)} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Bill
            </button>
            <button onClick={() => setIsNewIssueModalOpen(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors hidden sm:flex">
              <Plus className="w-3.5 h-3.5" /> Log Issue
            </button>
          </div>
        )}
        {(currentRole === 'principal' || currentRole === 'admin' || currentRole === 'sfsp') && (
          <button onClick={() => setIsExportModalOpen(true)} className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-gray-200 hidden sm:flex">
            <Download className="w-3.5 h-3.5 text-gray-500" /> Export
          </button>
        )}

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl p-3 z-50 animate-fade-in">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Notifications</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">{unreadCount} New</span>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} onClick={() => markNotificationRead(n.id)} className={`p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${n.read ? 'bg-white text-gray-400 hover:bg-gray-50' : 'bg-indigo-50/60 text-gray-800 hover:bg-indigo-50'}`}>
                    <p className="font-semibold text-gray-800">{n.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <span className="text-[9px] text-gray-400 mt-1 block">{n.timestamp}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => { setShowNotifications(false); setActivePage('notifications'); }} className="w-full text-center text-xs text-indigo-600 font-semibold mt-2 pt-2 border-t border-gray-100 block hover:underline">
                View All Notifications →
              </button>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div onClick={() => setActivePage('login')} className="flex items-center gap-2 pl-2 border-l border-gray-200 cursor-pointer group" title="Switch Login">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
            {currentRole === 'principal' ? 'PR' : currentRole === 'sfsp' ? 'TA' : currentRole === 'faculty' ? 'FA' : 'AD'}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors">
              {currentRole === 'principal' ? 'Dr. R. S. Patil' : currentRole === 'sfsp' ? 'SFSP Board' : currentRole === 'faculty' ? 'Dr. A. Kulkarni' : 'V. More'}
            </p>
            <p className="text-[10px] text-gray-400 capitalize">{currentRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
};
