import React from 'react';
import { useApp } from '../context/AppContext';
import { FileText, Download, Mail, Phone, Building2 } from 'lucide-react';

export const FacultyDocumentsProfile = () => {
  const { showToast } = useApp();
  const documents = [
    { name: "Faculty_Appointment_Letter.pdf", size: "2.4 MB", type: "Official Document", date: "2022-06-15" },
    { name: "R_and_D_Grant_Approval_2025.pdf", size: "3.1 MB", type: "Research Approval", date: "2025-09-10" },
    { name: "HPC_GPU_Server_Quotation_2026.pdf", size: "1.8 MB", type: "Vendor Attachment", date: "2026-08-08" },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-5 border border-gray-200 flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-extrabold">AK</div>
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Dr. Arvind Kulkarni</h2>
          <p className="text-xs text-indigo-600 font-semibold mt-0.5">HOD — Computer Science & Engineering</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1.5">
            <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-gray-400" /> a.kulkarni@spcollege.edu</span>
            <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" /> Ext. 4022</span>
            <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-gray-400" /> Room 201</span>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-500" /> Documents</h3>
        <div className="space-y-2">
          {documents.map((doc, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4.5 h-4.5 text-indigo-500" />
                <div><p className="text-xs font-semibold text-gray-800">{doc.name}</p><p className="text-[10px] text-gray-400">{doc.type} • {doc.size}</p></div>
              </div>
              <button onClick={() => showToast(`Downloaded ${doc.name}`, 'info')} className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 text-xs font-semibold flex items-center gap-1 transition-colors"><Download className="w-3.5 h-3.5" /> Download</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
