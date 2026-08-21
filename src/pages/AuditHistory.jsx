import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { History, ShieldCheck, Search } from 'lucide-react';

export const AuditHistory = () => {
  const { auditLogs } = useApp();
  const [filterQuery, setFilterQuery] = useState('');
  const filteredLogs = auditLogs.filter(log => log.actor.toLowerCase().includes(filterQuery.toLowerCase()) || log.action.toLowerCase().includes(filterQuery.toLowerCase()) || log.targetItem.toLowerCase().includes(filterQuery.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2"><History className="w-5 h-5 text-indigo-500" /> Audit History</h2>
          <p className="text-xs text-gray-500 mt-1">Immutable activity trail for approvals, escalations, and modifications.</p>
        </div>
        <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 self-start"><ShieldCheck className="w-3.5 h-3.5" /> Compliance Active</span>
      </div>

      <div className="bg-white rounded-xl p-3 flex items-center gap-2 border border-gray-200">
        <Search className="w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Filter by actor, action, or request ID..." className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider text-[11px] bg-gray-50/50"><th className="py-3 px-3">Log ID</th><th className="py-3 px-3">Timestamp</th><th className="py-3 px-3">Actor</th><th className="py-3 px-3">Action</th><th className="py-3 px-3">Target</th><th className="py-3 px-3">Value</th><th className="py-3 px-3">IP</th></tr></thead>
            <tbody className="divide-y divide-gray-50 font-mono text-[11px]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/80 font-sans">
                  <td className="py-3 px-3 font-mono font-bold text-indigo-600">{log.id}</td>
                  <td className="py-3 px-3 text-gray-400 font-mono">{log.timestamp}</td>
                  <td className="py-3 px-3"><p className="font-semibold text-gray-800">{log.actor}</p><p className="text-[10px] text-gray-400 uppercase">{log.role}</p></td>
                  <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.action.includes('ESCALATE') ? 'bg-violet-50 text-violet-700' : log.action.includes('APPROVE') ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{log.action}</span></td>
                  <td className="py-3 px-3 text-gray-600">{log.targetItem}</td>
                  <td className="py-3 px-3 font-bold text-gray-800">{log.amount}</td>
                  <td className="py-3 px-3 text-gray-400 font-mono">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
