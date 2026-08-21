import React from 'react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Plus, CheckCircle2 } from 'lucide-react';

export const NonFinancialRequestsManagement = () => {
  const { requests, setSelectedRequestModal, setIsNewIssueModalOpen, updateRequestStatus, currentRole } = useApp();
  const issues = requests.filter(r => r.type === 'non-financial');

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Faculty Issues & Requests</h2>
          <p className="text-xs text-gray-500">Non-financial maintenance issues and administrative requests.</p>
        </div>
        <button onClick={() => setIsNewIssueModalOpen(true)} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition-colors self-start">
          <Plus className="w-4 h-4" /> Log Issue
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {issues.map((issue) => (
          <div key={issue.id} onClick={() => setSelectedRequestModal(issue)} className="bg-white rounded-2xl p-5 border border-gray-200 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-[11px] font-mono font-bold text-indigo-600">{issue.id}</span>
                <StatusBadge status={issue.status} />
              </div>
              <h3 className="text-sm font-bold text-gray-900 line-clamp-2">{issue.title}</h3>
              <p className="text-xs text-gray-500 mt-2 line-clamp-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">{issue.description}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="text-gray-600">{issue.requesterName}</span>
                <span>{issue.department}</span>
              </div>
              {currentRole === 'principal' && issue.status !== 'Resolved' && (
                <button onClick={(e) => { e.stopPropagation(); updateRequestStatus(issue.id, 'Resolved', 'Resolved by Principal'); }} className="w-full py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
