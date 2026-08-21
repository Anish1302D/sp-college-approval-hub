import React from 'react';
import { useApp } from '../context/AppContext';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { GraduationCap, Plus, FileText, CheckCircle2, Clock } from 'lucide-react';

export const FacultyDashboard = () => {
  const { requests, setSelectedRequestModal, setIsNewFinancialModalOpen, setIsNewIssueModalOpen } = useApp();
  const myRequests = requests;
  const pendingCount = myRequests.filter(r => r.status.includes('Pending') || r.status.includes('Review')).length;
  const approvedCount = myRequests.filter(r => r.status.includes('Approved') || r.status.includes('Resolved')).length;

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600"><GraduationCap className="w-6 h-6" /></div>
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-widest">Faculty Portal</span>
            <h2 className="text-xl font-extrabold text-gray-900 mt-1">Welcome, Dr. Arvind Kulkarni</h2>
            <p className="text-xs text-gray-600 mt-0.5">HOD — Computer Science & Engineering</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsNewFinancialModalOpen(true)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 transition-colors"><Plus className="w-4 h-4" /> Submit Bill</button>
          <button onClick={() => setIsNewIssueModalOpen(true)} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition-colors"><Plus className="w-4 h-4" /> Log Issue</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Requisitions" value={myRequests.length} subtext="Active & Historical" icon={FileText} color="indigo" />
        <StatCard title="Under Review" value={pendingCount} subtext="Awaiting Action" icon={Clock} color="amber" />
        <StatCard title="Approved / Resolved" value={approvedCount} subtext="Processed" icon={CheckCircle2} color="emerald" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">My Requisitions</h3>
        <div className="space-y-2.5">
          {myRequests.map((req) => (
            <div key={req.id} onClick={() => setSelectedRequestModal(req)} className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-sm cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2 mb-0.5"><span className="text-xs font-mono font-bold text-indigo-600">{req.id}</span><StatusBadge status={req.status} /></div>
                <h4 className="text-sm font-semibold text-gray-800">{req.title}</h4>
                <p className="text-xs text-gray-400 mt-0.5">Submitted {req.dateSubmitted} • {req.category}</p>
              </div>
              <div className="text-right shrink-0">
                {req.amount ? <span className="text-base font-bold text-gray-900 block">₹{Number(req.amount).toLocaleString('en-IN')}</span> : <span className="text-xs text-gray-400 block">Non-Financial</span>}
                <span className="text-[10px] text-indigo-600 font-semibold hover:underline">View →</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
