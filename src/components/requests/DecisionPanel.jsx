import React, { useState } from 'react';
import { CheckCircle2, Scissors, Send, XCircle } from 'lucide-react';
import { api } from '../../api/client';
import { money, quantity } from '../../api/format';
import { useAction } from '../../hooks/useApi';

const CHOICES = {
  APPROVE: { label: 'Approve', icon: CheckCircle2, tone: 'bg-emerald-600 hover:bg-emerald-700', done: 'Request approved' },
  PARTIAL_APPROVE: { label: 'Partially approve', icon: Scissors, tone: 'bg-teal-600 hover:bg-teal-700', done: 'Partial approval recorded' },
  REJECT: { label: 'Reject', icon: XCircle, tone: 'bg-red-600 hover:bg-red-700', done: 'Request rejected' },
  ESCALATE: { label: 'Escalate', icon: Send, tone: 'bg-indigo-600 hover:bg-indigo-700', done: 'Escalated to the next authority' },
};

// Whole paise, so the preview total adds up the way the server's NUMERIC does.
const paise = (value) => Math.round(Number(value) * 100);

/**
 * What an approver can do with a request at their stage. The options come from
 * the server (`permissions.actions`); the server checks authority again when
 * the decision is sent, so nothing here grants anything.
 */
export const DecisionPanel = ({ request }) => {
  const { run, busy } = useAction();
  const [action, setAction] = useState(null);
  const [comments, setComments] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState(() =>
    Object.fromEntries(request.items.map((i) => [i.id, { qty: String(i.requestedQuantity), amount: '' }])));

  const setLine = (id, patch) => setLines((l) => ({ ...l, [id]: { ...l[id], ...patch } }));

  // Approved amount for a line: the typed override, else quantity x unit cost.
  const lineAmount = (item) => {
    const line = lines[item.id];
    if (line.amount !== '') return paise(line.amount);
    return Math.round(paise(line.qty) * paise(item.unitCost) / 100);
  };

  const preview = action === 'PARTIAL_APPROVE'
    ? request.items.reduce((sum, i) => sum + lineAmount(i), 0) / 100
    : null;

  const problems = [];
  if (action === 'REJECT' && reason.trim().length < 3) problems.push('Give a reason for rejecting.');
  if (action === 'PARTIAL_APPROVE') {
    for (const i of request.items) {
      const qty = Number(lines[i.id].qty);
      if (lines[i.id].qty === '' || Number.isNaN(qty) || qty < 0 || qty > i.requestedQuantity) {
        problems.push(`${i.budgetItem.name}: approve between 0 and ${quantity(i.requestedQuantity)}.`);
      } else if (lineAmount(i) > paise(i.estimatedTotal)) {
        problems.push(`${i.budgetItem.name}: the amount can't exceed ${money(i.estimatedTotal)}.`);
      } else if (qty === 0 && lineAmount(i) > 0) {
        problems.push(`${i.budgetItem.name}: an item left out (quantity 0) can't carry an amount.`);
      }
    }
  }

  const submit = async () => {
    const body = { action, comments: comments.trim() || undefined };
    if (action === 'REJECT') body.rejectionReason = reason.trim();
    if (action === 'PARTIAL_APPROVE') {
      body.itemDecisions = request.items.map((i) => ({
        requestItemId: i.id,
        approvedQuantity: Number(lines[i.id].qty),
        ...(lines[i.id].amount !== '' ? { approvedAmount: Number(lines[i.id].amount) } : {}),
      }));
    }
    const { ok } = await run(
      () => api(`/api/requests/${request.id}/actions`, { method: 'POST', body }),
      CHOICES[action].done,
    );
    if (ok) setAction(null);
  };

  const inputCls = 'w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400';

  return (
    <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-3">
      <div>
        <h4 className="text-xs font-bold text-gray-900">Your decision — {request.stage.name}</h4>
        <p className="text-[11px] text-gray-500">
          {request.stage.isFinal ? 'This is the final stage; there is no further escalation.' : 'Escalating sends the request to the next authority.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {request.permissions.actions.map((code) => {
          const c = CHOICES[code];
          const Icon = c.icon;
          const selected = action === code;
          return (
            <button
              key={code}
              onClick={() => setAction(selected ? null : code)}
              aria-pressed={selected}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${selected ? `${c.tone} text-white` : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'}`}
            >
              <Icon className="w-3.5 h-3.5" /> {c.label}
            </button>
          );
        })}
      </div>

      {action === 'PARTIAL_APPROVE' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2 px-3">Item</th>
                <th className="py-2 px-3 text-right">Requested</th>
                <th className="py-2 px-3">Approve qty</th>
                <th className="py-2 px-3">Amount (optional)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {request.items.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 px-3 font-semibold text-gray-800">{i.budgetItem.name}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-500">{quantity(i.requestedQuantity)} × {money(i.unitCost)}</td>
                  <td className="py-2 px-3 w-32">
                    <input type="number" min="0" max={i.requestedQuantity} step="0.01" aria-label={`Approved quantity for ${i.budgetItem.name}`}
                      className={inputCls} value={lines[i.id].qty} onChange={(e) => setLine(i.id, { qty: e.target.value })} />
                  </td>
                  <td className="py-2 px-3 w-40">
                    <input type="number" min="0" step="0.01" aria-label={`Approved amount for ${i.budgetItem.name}`}
                      placeholder={money(lineAmount(i) / 100)} className={inputCls}
                      value={lines[i.id].amount} onChange={(e) => setLine(i.id, { amount: e.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-gray-500 border-t border-gray-100">
            Set a quantity to 0 to leave that item out. Leave the amount blank to use quantity × unit cost, or enter a lower agreed price.
            <span className="float-right font-semibold text-gray-800">Sanctioning {money(preview)} of {money(request.tentativeTotalCost)}</span>
          </p>
        </div>
      )}

      {action === 'REJECT' && (
        <textarea rows={2} className={inputCls} placeholder="Reason for rejecting (required, shown to the requester)"
          value={reason} onChange={(e) => setReason(e.target.value)} />
      )}

      {action && (
        <>
          <textarea rows={2} className={inputCls} placeholder="Remarks (optional)" value={comments} onChange={(e) => setComments(e.target.value)} />
          {problems.length > 0 && (
            <ul className="text-[11px] text-red-600 list-disc pl-4 space-y-0.5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          )}
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setAction(null)} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100">Cancel</button>
            <button onClick={submit} disabled={busy || problems.length > 0}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 ${CHOICES[action].tone}`}>
              {busy ? 'Recording…' : `Confirm: ${CHOICES[action].label.toLowerCase()}`}
            </button>
          </div>
          <p className="text-[10px] text-gray-400">Your decision is recorded with your name and sealed in the request's history.</p>
        </>
      )}
    </div>
  );
};
