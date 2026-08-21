import React from 'react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

export const EscalatedRequestsManagement = () => {
  const { requests, setSelectedRequestModal, currentRole, updateRequestStatus } = useApp();
  const escalatedItems = requests.filter(r => (r.amount && r.amount >= 500000) || r.status.includes('Escalated'));

  return (
    <div className="space-y-5">
      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600"><ShieldAlert className="w-5 h-5" /></div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">Escalated Requests (≥ ₹5,00,000)</h2>
            <p className="text-xs text-gray-600 mt-0.5">Pending final decision from the SFSP Governing Trust.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {escalatedItems.map((req) => (
          <div key={req.id} className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3 hover:shadow-md transition-all">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold text-indigo-600">{req.id}</span>
                  <StatusBadge status={req.status} />
                </div>
                <h3 className="text-base font-bold text-gray-900">{req.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{req.department} • {req.requesterName}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Amount</span>
                <span className="text-xl font-extrabold text-gray-900">₹{Number(req.amount).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">{req.description}</p>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Submitted {req.dateSubmitted}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedRequestModal(req)} className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors">View File</button>
                {currentRole === 'sfsp' && <button onClick={() => updateRequestStatus(req.id, 'Approved & Released', 'Trust Board Approved')} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"><CheckCircle2 className="w-3.5 h-3.5" /> Board Approve</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
