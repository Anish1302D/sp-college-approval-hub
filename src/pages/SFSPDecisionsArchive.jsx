import React from 'react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { FolderArchive } from 'lucide-react';

export const SFSPDecisionsArchive = () => {
  const { requests, setSelectedRequestModal } = useApp();
  const decidedItems = requests.filter(r => r.status === 'Approved' || r.status === 'Approved & Released' || r.status === 'Rejected');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2"><FolderArchive className="w-5 h-5 text-violet-500" /> Decisions Archive</h2>
        <p className="text-xs text-gray-500 mt-1">Historical record of all executive decisions.</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider text-[11px] bg-gray-50/50"><th className="py-3 px-3">ID</th><th className="py-3 px-3">Title</th><th className="py-3 px-3">Amount</th><th className="py-3 px-3">Decision</th><th className="py-3 px-3">Date</th><th className="py-3 px-3 text-right">Detail</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {decidedItems.map((req) => (
                <tr key={req.id} onClick={() => setSelectedRequestModal(req)} className="hover:bg-indigo-50/40 cursor-pointer transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-indigo-600">{req.id}</td>
                  <td className="py-3 px-3 font-semibold text-gray-800">{req.title}</td>
                  <td className="py-3 px-3 font-bold text-gray-900">{req.amount ? `₹${Number(req.amount).toLocaleString('en-IN')}` : 'N/A'}</td>
                  <td className="py-3 px-3"><StatusBadge status={req.status} /></td>
                  <td className="py-3 px-3 text-gray-400">{req.dateSubmitted}</td>
                  <td className="py-3 px-3 text-right"><button onClick={(e) => { e.stopPropagation(); setSelectedRequestModal(req); }} className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 text-xs font-semibold hover:bg-violet-100 transition-colors">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
