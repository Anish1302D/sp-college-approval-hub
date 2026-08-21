import React from 'react';
import { useApp } from '../context/AppContext';
import { FileDown, Download } from 'lucide-react';

export const DataExports = () => {
  const { setIsExportModalOpen, showToast } = useApp();
  const reports = [
    { title: "Monthly Financial Audit Log", format: "XLSX", size: "4.2 MB", desc: "Complete log of approved, rejected, and escalated bills." },
    { title: "Inventory Valuation Summary", format: "XLSX", size: "1.8 MB", desc: "Asset register grouped by department and condition." },
    { title: "Executive Board Report", format: "PDF", size: "2.9 MB", desc: "Presentation format for SFSP Trust board meetings." },
    { title: "Faculty Issues Resolution Index", format: "PDF", size: "950 KB", desc: "Open and resolved maintenance issues log." }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2"><FileDown className="w-5 h-5 text-indigo-500" /> Data Exports</h2><p className="text-xs text-gray-500 mt-1">Export spreadsheets and PDF summaries.</p></div>
        <button onClick={() => setIsExportModalOpen(true)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 transition-colors self-start"><Download className="w-4 h-4" /> Custom Export</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((rep, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-5 border border-gray-200 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5"><span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200">{rep.format}</span><span className="text-[11px] text-gray-400">{rep.size}</span></div>
              <h3 className="text-sm font-bold text-gray-900">{rep.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{rep.desc}</p>
            </div>
            <button onClick={() => showToast(`Exporting ${rep.title}...`, 'success')} className="w-full py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-gray-200"><Download className="w-3.5 h-3.5 text-indigo-500" /> Download</button>
          </div>
        ))}
      </div>
    </div>
  );
};
