import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Plus, Search, Filter, ShieldAlert } from 'lucide-react';

export const FinancialRequestsManagement = () => {
  const { requests, setSelectedRequestModal, setIsNewFinancialModalOpen, searchQuery, setSearchQuery } = useApp();
  const [statusFilter, setStatusFilter] = useState('all');

  const financialRequests = requests.filter(r => r.type === 'financial');
  const filtered = financialRequests.filter(r => {
    const matchesSearch = searchQuery === '' || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.id.toLowerCase().includes(searchQuery.toLowerCase()) || r.requesterName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter !== 'all' && r.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
    return true;
  });

  const inputCls = "bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Financial Requests</h2>
          <p className="text-xs text-gray-500">All submitted bill requisitions.</p>
        </div>
        <button onClick={() => setIsNewFinancialModalOpen(true)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 transition-colors self-start">
          <Plus className="w-4 h-4" /> Create Bill
        </button>
      </div>

      <div className="bg-white rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 border border-gray-200">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search requisitions..." className={`w-full ${inputCls}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select className={inputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option><option value="pending approval">Pending</option><option value="approved">Approved</option><option value="escalated to sfsp trust">Escalated</option><option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider text-[11px] bg-gray-50/50">
                <th className="py-3 px-3">ID</th><th className="py-3 px-3">Title</th><th className="py-3 px-3">Department</th><th className="py-3 px-3">Amount</th><th className="py-3 px-3">Threshold</th><th className="py-3 px-3">Status</th><th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((req) => (
                <tr key={req.id} onClick={() => setSelectedRequestModal(req)} className="hover:bg-indigo-50/40 cursor-pointer transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-indigo-600">{req.id}</td>
                  <td className="py-3 px-3 font-semibold text-gray-800">{req.title}</td>
                  <td className="py-3 px-3 text-gray-500">{req.department}</td>
                  <td className="py-3 px-3 font-bold text-gray-900">₹{Number(req.amount).toLocaleString('en-IN')}</td>
                  <td className="py-3 px-3">{req.amount >= 500000 ? <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Trust (≥ ₹5L)</span> : <span className="text-[11px] text-gray-400">Principal (&lt; ₹5L)</span>}</td>
                  <td className="py-3 px-3"><StatusBadge status={req.status} /></td>
                  <td className="py-3 px-3 text-right">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedRequestModal(req); }} className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors">Detail</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
