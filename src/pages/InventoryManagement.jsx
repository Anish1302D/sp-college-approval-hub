import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Box, Plus, Search, Filter } from 'lucide-react';

export const InventoryManagement = () => {
  const { inventory, setIsInventoryModalOpen, searchQuery, setSearchQuery } = useApp();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const filtered = inventory.filter(item => {
    const matchesSearch = searchQuery === '' || item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) || item.id.toLowerCase().includes(searchQuery.toLowerCase()) || item.location.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    return true;
  });

  const inputCls = "bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2"><Box className="w-5 h-5 text-indigo-500" /> Inventory Management</h2><p className="text-xs text-gray-500 mt-1">Asset register, quantities, location, and condition.</p></div>
        <button onClick={() => setIsInventoryModalOpen(true)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 transition-colors self-start"><Plus className="w-4 h-4" /> Add Asset</button>
      </div>
      <div className="bg-white rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 border border-gray-200">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]"><Search className="w-4 h-4 text-gray-400" /><input type="text" placeholder="Search assets..." className={`w-full ${inputCls}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
        <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-gray-400" /><select className={inputCls} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">All Categories</option><option value="IT Hardware">IT Hardware</option><option value="AV Equipment">AV Equipment</option><option value="Laboratory Equipment">Lab Equipment</option><option value="Furniture">Furniture</option><option value="Power & Electrical">Power</option></select></div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider text-[11px] bg-gray-50/50"><th className="py-3 px-3">ID</th><th className="py-3 px-3">Item</th><th className="py-3 px-3">Category</th><th className="py-3 px-3">Location</th><th className="py-3 px-3">Qty</th><th className="py-3 px-3">Unit Cost</th><th className="py-3 px-3">Total</th><th className="py-3 px-3">Condition</th><th className="py-3 px-3">Bill</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/80">
                  <td className="py-3 px-3 font-mono font-bold text-indigo-600">{item.id}</td>
                  <td className="py-3 px-3 font-semibold text-gray-800">{item.itemName}</td>
                  <td className="py-3 px-3 text-gray-500">{item.category}</td>
                  <td className="py-3 px-3 text-gray-600">{item.location}</td>
                  <td className="py-3 px-3 font-bold text-gray-900">{item.quantity}</td>
                  <td className="py-3 px-3 text-gray-500">₹{item.unitValue.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-3 font-bold text-emerald-700">₹{item.totalValue.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-3"><StatusBadge status={item.condition} /></td>
                  <td className="py-3 px-3 font-mono text-[11px] text-gray-400">{item.linkedBill}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
