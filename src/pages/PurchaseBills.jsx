import React from 'react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Receipt, Download } from 'lucide-react';

export const PurchaseBills = () => {
  const { bills, showToast } = useApp();

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2"><Receipt className="w-5 h-5 text-indigo-500" /> Purchase Bills</h2><p className="text-xs text-gray-500 mt-1">Official invoices, payment statuses, and vendor vouchers.</p></div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider text-[11px] bg-gray-50/50"><th className="py-3 px-3">Bill Ref</th><th className="py-3 px-3">Vendor</th><th className="py-3 px-3">Items</th><th className="py-3 px-3">Date</th><th className="py-3 px-3">Amount</th><th className="py-3 px-3">Status</th><th className="py-3 px-3 text-right">Invoice</th></tr></thead>
          <tbody className="divide-y divide-gray-50">
            {bills.map((b, idx) => (
              <tr key={idx} className="hover:bg-gray-50/80">
                <td className="py-3 px-3 font-mono font-bold text-indigo-600">{b.billNo}</td>
                <td className="py-3 px-3 font-semibold text-gray-800">{b.vendor}</td>
                <td className="py-3 px-3 text-gray-600">{b.items}</td>
                <td className="py-3 px-3 text-gray-400">{b.date}</td>
                <td className="py-3 px-3 font-bold text-gray-900">₹{Number(b.amount).toLocaleString('en-IN')}</td>
                <td className="py-3 px-3"><StatusBadge status={b.status} /></td>
                <td className="py-3 px-3 text-right"><button onClick={() => showToast(`Downloaded voucher for ${b.billNo}`, 'info')} className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold flex items-center gap-1 ml-auto transition-colors"><Download className="w-3.5 h-3.5" /> PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
