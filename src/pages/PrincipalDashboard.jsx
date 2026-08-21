import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { FileText, ShieldAlert, IndianRupee, AlertCircle, Eye, Plus } from 'lucide-react';

export const PrincipalDashboard = () => {
  const { requests, setSelectedRequestModal, setIsNewFinancialModalOpen, searchQuery } = useApp();
  const [activeTab, setActiveTab] = useState('all');

  const pendingCount = requests.filter(r => r.type === 'financial' && r.status === 'Pending Approval').length;
  const escalatedCount = requests.filter(r => r.status === 'Escalated to SFSP Trust').length;
  const issueCount = requests.filter(r => r.type === 'non-financial' && r.status === 'In Review').length;
  const totalApprovedAmount = requests.filter(r => r.status === 'Approved' || r.status === 'Approved & Released').reduce((acc, r) => acc + (r.amount || 0), 0);

  const filteredRequests = requests.filter(r => {
    const matchesSearch = searchQuery === '' || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.requesterName.toLowerCase().includes(searchQuery.toLowerCase()) || r.id.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'standard') return r.type === 'financial' && (r.amount || 0) < 500000;
    if (activeTab === 'escalated') return (r.amount || 0) >= 500000 || r.status.includes('Escalated');
    if (activeTab === 'issues') return r.type === 'non-financial';
    return true;
  });

  const tabCls = (id) => `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === id ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-700'}`;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-gray-200">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 uppercase tracking-widest">Principal Portal</span>
          <h2 className="text-xl font-extrabold text-gray-900 mt-2">Operations Overview</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage bill approvals, faculty issues, and escalated requisitions.</p>
        </div>
        <button onClick={() => setIsNewFinancialModalOpen(true)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 transition-colors self-start">
          <Plus className="w-4 h-4" /> Log Financial Bill
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Pending Bills (< ₹5L)" value={pendingCount} subtext="Requires Decision" icon={FileText} color="amber" trend={{ positive: true, value: "2 new today", label: "vs yesterday" }} />
        <StatCard title="Escalated to Trust (≥ ₹5L)" value={escalatedCount} subtext="SFSP Board Review" icon={ShieldAlert} color="indigo" trend={{ positive: true, value: "₹20.3L", label: "Escalated value" }} />
        <StatCard title="Open Faculty Issues" value={issueCount} subtext="Non-Financial" icon={AlertCircle} color="sky" />
        <StatCard title="Approved Budget" value={`₹${(totalApprovedAmount / 100000).toFixed(1)}L`} subtext="YTD Disbursed" icon={IndianRupee} color="emerald" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Requisitions & Approvals</h3>
            <p className="text-xs text-gray-400">Click a row to view details and take action.</p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
            <button onClick={() => setActiveTab('all')} className={tabCls('all')}>All ({requests.length})</button>
            <button onClick={() => setActiveTab('standard')} className={tabCls('standard')}>Standard</button>
            <button onClick={() => setActiveTab('escalated')} className={tabCls('escalated')}>Escalated</button>
            <button onClick={() => setActiveTab('issues')} className={tabCls('issues')}>Issues</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">ID</th><th className="py-3 px-3">Title</th><th className="py-3 px-3">Category</th><th className="py-3 px-3">Requester</th><th className="py-3 px-3">Amount</th><th className="py-3 px-3">Status</th><th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRequests.map((req) => (
                <tr key={req.id} onClick={() => setSelectedRequestModal(req)} className="hover:bg-indigo-50/40 cursor-pointer transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-indigo-600">{req.id}</td>
                  <td className="py-3 px-3 font-semibold text-gray-800 max-w-xs truncate">{req.title}</td>
                  <td className="py-3 px-3 text-gray-500">{req.category}</td>
                  <td className="py-3 px-3"><p className="font-medium text-gray-700">{req.requesterName}</p><p className="text-[10px] text-gray-400">{req.department}</p></td>
                  <td className="py-3 px-3 font-bold">{req.amount ? <span className={req.amount >= 500000 ? 'text-amber-600 font-extrabold' : 'text-gray-800'}>₹{Number(req.amount).toLocaleString('en-IN')}</span> : <span className="text-gray-400">Non-Financial</span>}</td>
                  <td className="py-3 px-3"><StatusBadge status={req.status} /></td>
                  <td className="py-3 px-3 text-right">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedRequestModal(req); }} className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors inline-flex items-center gap-1 text-xs font-medium">
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
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
