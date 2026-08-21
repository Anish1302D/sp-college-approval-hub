import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Plus } from 'lucide-react';

export const FacultyMyRequests = () => {
  const { requests, setSelectedRequestModal, setIsNewFinancialModalOpen, setIsNewIssueModalOpen } = useApp();
  const [filterType, setFilterType] = useState('all');
  const filtered = requests.filter(r => { if (filterType === 'financial') return r.type === 'financial'; if (filterType === 'non-financial') return r.type === 'non-financial'; return true; });
  const tabCls = (id) => `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterType === id ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h2 className="text-xl font-extrabold text-gray-900">My Submitted Requisitions</h2><p className="text-xs text-gray-500">Track approval status of your bills and issues.</p></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsNewFinancialModalOpen(true)} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Bill</button>
          <button onClick={() => setIsNewIssueModalOpen(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Issue</button>
        </div>
      </div>
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button onClick={() => setFilterType('all')} className={tabCls('all')}>All</button>
        <button onClick={() => setFilterType('financial')} className={tabCls('financial')}>Financial</button>
        <button onClick={() => setFilterType('non-financial')} className={tabCls('non-financial')}>Non-Financial</button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider text-[11px] bg-gray-50/50"><th className="py-3 px-3">ID</th><th className="py-3 px-3">Title</th><th className="py-3 px-3">Type</th><th className="py-3 px-3">Amount</th><th className="py-3 px-3">Date</th><th className="py-3 px-3">Status</th><th className="py-3 px-3 text-right">Detail</th></tr></thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((req) => (
              <tr key={req.id} onClick={() => setSelectedRequestModal(req)} className="hover:bg-indigo-50/40 cursor-pointer transition-colors">
                <td className="py-3 px-3 font-mono font-bold text-indigo-600">{req.id}</td>
                <td className="py-3 px-3 font-semibold text-gray-800">{req.title}</td>
                <td className="py-3 px-3 text-gray-500 capitalize">{req.type}</td>
                <td className="py-3 px-3 font-bold text-gray-900">{req.amount ? `₹${Number(req.amount).toLocaleString('en-IN')}` : 'N/A'}</td>
                <td className="py-3 px-3 text-gray-400">{req.dateSubmitted}</td>
                <td className="py-3 px-3"><StatusBadge status={req.status} /></td>
                <td className="py-3 px-3 text-right"><span className="text-indigo-600 font-semibold hover:underline">Timeline</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
