import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useApp } from '../../context/AppContext';
import { FileSpreadsheet, FileText, Download } from 'lucide-react';

export const ExportModal = () => {
  const { isExportModalOpen, setIsExportModalOpen, showToast } = useApp();
  const [exportFormat, setExportFormat] = useState('excel');
  const [dateRange, setDateRange] = useState('all');

  const handleExport = () => {
    showToast(`Export generated! Downloading ${exportFormat.toUpperCase()} report...`, 'success');
    setIsExportModalOpen(false);
  };

  return (
    <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Export Data & Reports">
      <div className="space-y-5">
        <p className="text-sm text-gray-500">Select format and scope for your data export.</p>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Export Format</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setExportFormat('excel')} className={`p-4 rounded-xl border flex items-center gap-3 text-left transition-all ${exportFormat === 'excel' ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
              <FileSpreadsheet className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-800">Excel (.xlsx)</p>
                <p className="text-[11px] text-gray-400">Full audit data</p>
              </div>
            </button>
            <button type="button" onClick={() => setExportFormat('pdf')} className={`p-4 rounded-xl border flex items-center gap-3 text-left transition-all ${exportFormat === 'pdf' ? 'bg-red-50 border-red-300 ring-1 ring-red-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
              <FileText className="w-6 h-6 text-red-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-800">PDF Summary</p>
                <p className="text-[11px] text-gray-400">Formatted report</p>
              </div>
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Date Range</label>
          <select className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="all">All Records</option><option value="current_month">August 2026</option><option value="q2_2026">Q2 2026</option><option value="fy_2025_26">FY 2025-2026</option>
          </select>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={() => setIsExportModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
          <button type="button" onClick={handleExport} className="px-5 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 transition-colors"><Download className="w-4 h-4" /> Download</button>
        </div>
      </div>
    </Modal>
  );
};
