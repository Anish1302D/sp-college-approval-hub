import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';
import { useApp } from '../../context/AppContext';
import { FileText, User, Calendar, Building2, Clock, ShieldCheck, CornerUpRight, Download, CheckCircle2, XCircle, Send } from 'lucide-react';

export const RequestDetailModal = () => {
  const { selectedRequestModal, setSelectedRequestModal, updateRequestStatus, currentRole, showToast } = useApp();
  const [decisionNote, setDecisionNote] = useState('');

  if (!selectedRequestModal) return null;
  const req = selectedRequestModal;
  const isFinancial = req.type === 'financial';
  const isEscalatedAmount = req.amount && req.amount >= 500000;

  const handleAction = (status) => {
    updateRequestStatus(req.id, status, decisionNote);
    setSelectedRequestModal(null);
    setDecisionNote('');
  };

  return (
    <Modal isOpen={!!selectedRequestModal} onClose={() => { setSelectedRequestModal(null); setDecisionNote(''); }} title={`Request — ${req.id}`} maxWidth="max-w-4xl">
      <div className="space-y-5">
        {/* Header */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">{req.category}</span>
              <StatusBadge status={req.status} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">{req.title}</h2>
          </div>
          {isFinancial && req.amount && (
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Amount</span>
              <span className="text-2xl font-extrabold text-gray-900">₹{Number(req.amount).toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>

        {/* Escalation Banner */}
        {isFinancial && isEscalatedAmount && (
          <div className="p-3 rounded-lg bg-violet-50 border border-violet-200 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-violet-800">SFSP Trust Governance (≥ ₹5,00,000)</h4>
              <p className="text-[11px] text-violet-700 mt-0.5">Final approval authority rests with the SFSP Governing Board.</p>
            </div>
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            { icon: User, label: 'Requester', value: req.requesterName, sub: req.requesterRole },
            { icon: Building2, label: 'Department', value: req.department },
            { icon: Calendar, label: 'Submitted', value: req.dateSubmitted },
            { icon: Clock, label: 'Priority', value: `${req.priority} Priority` },
          ].map((info, i) => (
            <div key={i} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
              <span className="text-gray-400 flex items-center gap-1.5 mb-1">
                <info.icon className="w-3.5 h-3.5 text-indigo-500" /> {info.label}
              </span>
              <p className="font-semibold text-gray-800">{info.value}</p>
              {info.sub && <p className="text-[10px] text-gray-400">{info.sub}</p>}
            </div>
          ))}
        </div>

        {/* Description */}
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description</h4>
          <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-100 text-sm text-gray-700 leading-relaxed">{req.description}</div>
        </div>

        {/* Attachments */}
        {req.attachments?.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Documents</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {req.attachments.map((att, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-white border border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-medium text-gray-800 truncate">{att.name}</p>
                      <p className="text-[10px] text-gray-400">{att.size} • {att.type}</p>
                    </div>
                  </div>
                  <button onClick={() => showToast(`Downloaded: ${att.name}`, 'info')} className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-gray-100 transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Approval Timeline</h4>
          <div className="space-y-2.5 pl-1.5 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
            {req.history?.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 relative">
                <div className="w-3.5 h-3.5 rounded-full bg-indigo-500 border-[3px] border-white ring-1 ring-gray-200 shrink-0 mt-0.5 z-10"></div>
                <div className="flex-1 p-3 rounded-lg bg-gray-50 border border-gray-100 text-xs">
                  <div className="flex items-center justify-between text-gray-400 mb-0.5">
                    <span className="font-semibold text-gray-800">{item.user}</span>
                    <span className="text-[11px]">{item.date}</span>
                  </div>
                  <p className="font-medium text-indigo-600">{item.action}</p>
                  {item.notes && <p className="text-gray-500 mt-0.5 italic">"{item.notes}"</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <CornerUpRight className="w-3.5 h-3.5 text-indigo-500" /> Actions — {currentRole.toUpperCase()}
            </h4>
          </div>
          <input type="text" placeholder="Add decision remarks (optional)..." className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {currentRole === 'principal' && (
              <>
                {!isEscalatedAmount && <button onClick={() => handleAction('Approved')} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Approve (&lt; ₹5L)</button>}
                {isEscalatedAmount && <button onClick={() => handleAction('Escalated to SFSP Trust')} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /> Escalate to Trust</button>}
                {!isFinancial && <button onClick={() => handleAction('Resolved')} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Resolve</button>}
                <button onClick={() => handleAction('Rejected')} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Reject</button>
              </>
            )}
            {currentRole === 'sfsp' && (
              <>
                <button onClick={() => handleAction('Approved & Released')} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Board Approve & Release</button>
                <button onClick={() => handleAction('Rejected')} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Reject</button>
              </>
            )}
            {currentRole === 'admin' && (
              <button onClick={() => handleAction('In Review')} className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Log Verification</button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
