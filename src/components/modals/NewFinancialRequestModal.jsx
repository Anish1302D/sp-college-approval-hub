import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useApp } from '../../context/AppContext';
import { Upload, AlertTriangle } from 'lucide-react';

export const NewFinancialRequestModal = () => {
  const { isNewFinancialModalOpen, setIsNewFinancialModalOpen, addRequest } = useApp();
  const [formData, setFormData] = useState({ title: '', category: 'Laboratory Equipment', amount: '', department: 'Computer Science & Engg', requesterName: 'Dr. Arvind Kulkarni', priority: 'Medium', description: '', fileName: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.amount || !formData.description) return;
    addRequest({ ...formData, type: 'financial' });
    setIsNewFinancialModalOpen(false);
    setFormData({ title: '', category: 'Laboratory Equipment', amount: '', department: 'Computer Science & Engg', requesterName: 'Dr. Arvind Kulkarni', priority: 'Medium', description: '', fileName: '' });
  };

  const isEscalatedAmount = parseFloat(formData.amount || 0) >= 500000;
  const inputCls = "w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400";

  return (
    <Modal isOpen={isNewFinancialModalOpen} onClose={() => setIsNewFinancialModalOpen(false)} title="Create New Financial Bill Request">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Requisition Title *</label>
          <input type="text" required placeholder="e.g. Purchase of HPC Server Node" className={inputCls} value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Category</label>
            <select className={inputCls} value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
              <option>Laboratory Equipment</option><option>IT Infrastructure</option><option>Library & Learning Resources</option><option>Infrastructure & Campus</option><option>Research & Development</option><option>Office Machinery & Supplies</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Estimated Amount (₹) *</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-400 font-bold text-sm">₹</span>
              <input type="number" required min="100" step="100" placeholder="450000" className={`${inputCls} pl-7`} value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
            </div>
          </div>
        </div>
        {isEscalatedAmount && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-800 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Escalation Threshold Triggered (≥ ₹5,00,000)</p>
              <p className="text-amber-700 mt-0.5">This bill will require SFSP Governing Trust approval after Principal review.</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Department</label>
            <input type="text" className={inputCls} value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Priority</label>
            <select className={inputCls} value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
              <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Justification *</label>
          <textarea required rows={3} placeholder="Describe the necessity and specifications..." className={inputCls} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Attachment</label>
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center bg-gray-50 hover:border-indigo-300 transition-colors">
            <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1.5" />
            <input type="file" onChange={(e) => setFormData({ ...formData, fileName: e.target.files[0]?.name || '' })} className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className="cursor-pointer text-xs text-indigo-600 font-semibold hover:underline">
              {formData.fileName ? `Attached: ${formData.fileName}` : 'Click to simulate file attachment'}
            </label>
            <p className="text-[11px] text-gray-400 mt-0.5">PDF, DOCX, XLSX up to 10MB</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={() => setIsNewFinancialModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
          <button type="submit" className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">Submit Requisition</button>
        </div>
      </form>
    </Modal>
  );
};
