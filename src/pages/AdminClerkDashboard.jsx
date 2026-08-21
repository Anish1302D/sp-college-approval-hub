import React from 'react';
import { useApp } from '../context/AppContext';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Box, Receipt, ClipboardList, Plus, FileDown } from 'lucide-react';

export const AdminClerkDashboard = () => {
  const { inventory, bills, setIsInventoryModalOpen, setIsExportModalOpen } = useApp();
  const totalAssetValue = inventory.reduce((acc, item) => acc + item.totalValue, 0);
  const maintenanceNeeded = inventory.filter(item => item.condition.includes('Maintenance') || item.condition.includes('Repair')).length;

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-violet-50 border border-violet-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200 uppercase tracking-widest">Admin / Clerk</span>
          <h2 className="text-xl font-extrabold text-gray-900 mt-1">Operations Dashboard</h2>
          <p className="text-xs text-gray-600 mt-0.5">Inventory management, purchase bills, and data exports.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsInventoryModalOpen(true)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 transition-colors"><Plus className="w-4 h-4" /> Add Asset</button>
          <button onClick={() => setIsExportModalOpen(true)} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-2 transition-colors"><FileDown className="w-4 h-4" /> Report</button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Registered Assets" value={inventory.length} subtext="Campus Equipment" icon={Box} color="indigo" />
        <StatCard title="Total Valuation" value={`₹${(totalAssetValue / 100000).toFixed(1)}L`} subtext="Audited Base" icon={Receipt} color="emerald" />
        <StatCard title="Flagged for Repair" value={maintenanceNeeded} subtext="Needs Maintenance" icon={ClipboardList} color="rose" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Recent Purchase Bills</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider text-[11px] bg-gray-50/50"><th className="py-3 px-3">Bill No</th><th className="py-3 px-3">Vendor</th><th className="py-3 px-3">Items</th><th className="py-3 px-3">Amount</th><th className="py-3 px-3">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {bills.map((b, idx) => (
                <tr key={idx} className="hover:bg-gray-50/80">
                  <td className="py-3 px-3 font-mono font-bold text-indigo-600">{b.billNo}</td>
                  <td className="py-3 px-3 font-semibold text-gray-800">{b.vendor}</td>
                  <td className="py-3 px-3 text-gray-500">{b.items}</td>
                  <td className="py-3 px-3 font-bold text-gray-900">₹{Number(b.amount).toLocaleString('en-IN')}</td>
                  <td className="py-3 px-3"><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
