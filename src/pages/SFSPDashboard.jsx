import React from 'react';
import { useApp } from '../context/AppContext';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Building, ShieldAlert, CheckCircle2, IndianRupee } from 'lucide-react';

export const SFSPDashboard = () => {
  const { requests, setSelectedRequestModal, updateRequestStatus } = useApp();
  const escalatedItems = requests.filter(r => (r.amount && r.amount >= 500000) || r.status.includes('Escalated'));
  const totalEscalatedAmount = escalatedItems.reduce((acc, r) => acc + (r.amount || 0), 0);
  const totalApprovedByTrust = requests.filter(r => r.status === 'Approved & Released').length;

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-violet-50 border border-violet-200">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-violet-100 text-violet-600"><Building className="w-6 h-6" /></div>
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 uppercase tracking-widest">SFSP Trust Authority</span>
            <h2 className="text-xl font-extrabold text-gray-900 mt-1">Governing Board Dashboard</h2>
            <p className="text-xs text-gray-600 mt-0.5">Final decisions on capital requisitions ≥ ₹5,00,000.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Pending Review" value={escalatedItems.length} subtext="Trust Board Vote" icon={ShieldAlert} color="amber" />
        <StatCard title="Total Value Pending" value={`₹${(totalEscalatedAmount / 100000).toFixed(1)}L`} subtext="Capital Requisitions" icon={IndianRupee} color="indigo" />
        <StatCard title="Trust Approved" value={totalApprovedByTrust} subtext="Released YTD" icon={CheckCircle2} color="emerald" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-500" /> Escalated Case Files</h3>
        <div className="space-y-3">
          {escalatedItems.map((req) => (
            <div key={req.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-white hover:border-gray-200 transition-all">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2"><span className="text-xs font-mono font-bold text-indigo-600">{req.id}</span><StatusBadge status={req.status} /></div>
                <h4 className="text-sm font-bold text-gray-900">{req.title}</h4>
                <p className="text-xs text-gray-500">{req.department} • {req.requesterName}</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                <div className="text-right"><span className="text-[10px] text-gray-400 uppercase tracking-wider block">Amount</span><span className="text-lg font-extrabold text-gray-900">₹{Number(req.amount).toLocaleString('en-IN')}</span></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedRequestModal(req)} className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold transition-colors">View</button>
                  <button onClick={() => updateRequestStatus(req.id, 'Approved & Released', 'Trust Board Approved')} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors">Approve</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
