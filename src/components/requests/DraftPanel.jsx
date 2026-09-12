import React, { useState } from 'react';
import { Plus, Send, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { money } from '../../api/format';
import { useApp } from '../../context/AppContext';
import { useApi, useAction } from '../../hooks/useApi';

/** For the author of a draft: add lines, submit it into the workflow, or discard it. */
export const DraftPanel = ({ request }) => {
  const { closeRecord } = useApp();
  const { run, busy } = useAction();
  const catalogue = useApi(`/api/budget-heads/${request.budgetHead.id}/items`);
  const [line, setLine] = useState({ budgetItemId: '', quantity: '', unitCost: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onRequest = new Set(request.items.map((i) => i.budgetItem.id));
  const available = (catalogue.data ?? []).filter((i) => !onRequest.has(i.id));

  const addLine = async () => {
    const { ok } = await run(() => api(`/api/requests/${request.id}/items`, {
      method: 'POST',
      body: { budgetItemId: Number(line.budgetItemId), quantity: Number(line.quantity), unitCost: Number(line.unitCost) },
    }), 'Item added');
    if (ok) setLine({ budgetItemId: '', quantity: '', unitCost: '' });
  };

  const submit = () => run(() => api(`/api/requests/${request.id}/submit`, { method: 'POST' }), 'Submitted for approval');

  const discard = async () => {
    const { ok } = await run(() => api(`/api/requests/${request.id}`, { method: 'DELETE' }), 'Draft deleted');
    if (ok) closeRecord();
  };

  const canAdd = line.budgetItemId && Number(line.quantity) > 0 && line.unitCost !== '' && Number(line.unitCost) >= 0;
  const inputCls = 'bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400';

  return (
    <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3">
      <div>
        <h4 className="text-xs font-bold text-gray-900">This is a draft</h4>
        <p className="text-[11px] text-gray-600">Only you can see it. Nothing is sent for approval until you submit.</p>
      </div>

      {available.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Item
            <select className={`${inputCls} block mt-1 min-w-[180px]`} value={line.budgetItemId}
              onChange={(e) => setLine({ ...line, budgetItemId: e.target.value })}>
              <option value="">Choose…</option>
              {available.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.itemType.toLowerCase()})</option>)}
            </select>
          </label>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Qty
            <input type="number" min="0.01" step="0.01" className={`${inputCls} block mt-1 w-20`} value={line.quantity}
              onChange={(e) => setLine({ ...line, quantity: e.target.value })} />
          </label>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Unit cost ₹
            <input type="number" min="0" step="0.01" className={`${inputCls} block mt-1 w-28`} value={line.unitCost}
              onChange={(e) => setLine({ ...line, unitCost: e.target.value })} />
          </label>
          <button onClick={addLine} disabled={!canAdd || busy}
            className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:border-gray-300 flex items-center gap-1 disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> Add item
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {confirmDelete ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-red-700 font-semibold">Delete this draft and its files?</span>
            <button onClick={discard} disabled={busy} className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-semibold">Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 rounded-lg text-gray-500 hover:bg-gray-100">Keep</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-600 font-semibold flex items-center gap-1 hover:underline">
            <Trash2 className="w-3.5 h-3.5" /> Delete draft
          </button>
        )}
        <button onClick={submit} disabled={busy || !request.permissions.canSubmit}
          title={request.permissions.canSubmit ? '' : 'Add at least one item first'}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
          <Send className="w-3.5 h-3.5" /> Submit {money(request.tentativeTotalCost)} for approval
        </button>
      </div>
    </div>
  );
};
