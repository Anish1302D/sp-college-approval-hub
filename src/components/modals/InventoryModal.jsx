import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useApp } from '../../context/AppContext';

export const InventoryModal = () => {
  const { isInventoryModalOpen, setIsInventoryModalOpen, addInventoryItem } = useApp();
  const [formData, setFormData] = useState({ itemName: '', category: 'IT Hardware', location: 'Computer Lab 1', quantity: 1, unitValue: '', condition: 'Good', linkedBill: 'BILL-2026-0089' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.itemName || !formData.unitValue) return;
    addInventoryItem(formData);
    setIsInventoryModalOpen(false);
    setFormData({ itemName: '', category: 'IT Hardware', location: 'Computer Lab 1', quantity: 1, unitValue: '', condition: 'Good', linkedBill: 'BILL-2026-0089' });
  };

  const inputCls = "w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400";

  return (
    <Modal isOpen={isInventoryModalOpen} onClose={() => setIsInventoryModalOpen(false)} title="Add Inventory Asset">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Item Name *</label>
          <input type="text" required placeholder="e.g. Dell OptiPlex 7090 Workstation" className={inputCls} value={formData.itemName} onChange={(e) => setFormData({ ...formData, itemName: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Category</label>
            <select className={inputCls} value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
              <option>IT Hardware</option><option>AV Equipment</option><option>Laboratory Equipment</option><option>Furniture</option><option>Office Machinery</option><option>Power & Electrical</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Location</label>
            <input type="text" required placeholder="e.g. Science Wing Room 302" className={inputCls} value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Quantity</label>
            <input type="number" min="1" required className={inputCls} value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Unit Cost (₹) *</label>
            <input type="number" required placeholder="45000" className={inputCls} value={formData.unitValue} onChange={(e) => setFormData({ ...formData, unitValue: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Condition</label>
            <select className={inputCls} value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value })}>
              <option>Good</option><option>Needs Maintenance</option><option>Critical Maintenance Needed</option><option>Under Repair</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={() => setIsInventoryModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
          <button type="submit" className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">Add Asset</button>
        </div>
      </form>
    </Modal>
  );
};
