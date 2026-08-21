import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useApp } from '../../context/AppContext';
import { Upload } from 'lucide-react';

export const NewIssueModal = () => {
  const { isNewIssueModalOpen, setIsNewIssueModalOpen, addRequest } = useApp();
  const [formData, setFormData] = useState({ title: '', category: 'IT & Network Issue', department: 'Computer Science & Engg', requesterName: 'Dr. Arvind Kulkarni', priority: 'Medium', description: '', fileName: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description) return;
    addRequest({ ...formData, amount: null, type: 'non-financial' });
    setIsNewIssueModalOpen(false);
    setFormData({ title: '', category: 'IT & Network Issue', department: 'Computer Science & Engg', requesterName: 'Dr. Arvind Kulkarni', priority: 'Medium', description: '', fileName: '' });
  };

  const inputCls = "w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400";

  return (
    <Modal isOpen={isNewIssueModalOpen} onClose={() => setIsNewIssueModalOpen(false)} title="Log Faculty Non-Financial Issue">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Issue Title *</label>
          <input type="text" required placeholder="e.g. Wi-Fi signal dropouts in Room B-204" className={inputCls} value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Category</label>
            <select className={inputCls} value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
              <option>IT & Network Issue</option><option>Faculty Welfare & Facilities</option><option>Safety & Governance</option><option>Classroom Maintenance</option><option>Library Access</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Priority</label>
            <select className={inputCls} value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
              <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Description *</label>
          <textarea required rows={4} placeholder="Describe the issue..." className={inputCls} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Attachment (optional)</label>
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center bg-gray-50 hover:border-indigo-300 transition-colors">
            <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
            <input type="file" onChange={(e) => setFormData({ ...formData, fileName: e.target.files[0]?.name || '' })} className="hidden" id="issue-file-upload" />
            <label htmlFor="issue-file-upload" className="cursor-pointer text-xs text-indigo-600 font-semibold hover:underline">
              {formData.fileName ? `Attached: ${formData.fileName}` : 'Click to attach'}
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={() => setIsNewIssueModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
          <button type="submit" className="px-5 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">Submit Issue</button>
        </div>
      </form>
    </Modal>
  );
};
