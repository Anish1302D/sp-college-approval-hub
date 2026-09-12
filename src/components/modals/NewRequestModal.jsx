import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Paperclip, Plus, Trash2, X } from 'lucide-react';
import { api, qs } from '../../api/client';
import { money } from '../../api/format';
import { useApp } from '../../context/AppContext';
import { useApi } from '../../hooks/useApi';
import { ACCEPT } from '../ui/Attachments';
import { Modal } from '../ui/Modal';

// A plain counter for React keys. crypto.randomUUID() would be neater, but it
// only exists on HTTPS or localhost pages, and an intranet server reached over
// plain HTTP would crash this form on open.
let nextKey = 0;
const blankLine = () => ({ key: ++nextKey, budgetItemId: '', quantity: '', unitCost: '', remarks: '' });
const blankForm = () => ({
  title: '', description: '', budgetHeadId: '', financialYearId: '', departmentId: '', courseId: '', urgency: 'Medium',
});

// Whole paise, so the running total matches the server's exact NUMERIC maths.
const linePaise = (l) => Math.round(Math.round(Number(l.quantity) * 100) * Math.round(Number(l.unitCost) * 100) / 100);

export const NewRequestModal = () => {
  const { modals, closeModal, showToast, refresh, openRecord } = useApp();
  const open = modals.newRequest;
  const [form, setForm] = useState(blankForm);
  const [lines, setLines] = useState(() => [blankLine()]);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(null); // 'draft' | 'submit' | null
  const [attempted, setAttempted] = useState(null); // which button was last pressed

  const heads = useApi(open ? '/api/budget-heads' : null);
  const years = useApi(open ? '/api/financial-years' : null);
  const departments = useApi(open ? '/api/departments' : null);
  const courses = useApi(open && form.departmentId ? `/api/courses${qs({ departmentId: form.departmentId })}` : null);
  const stages = useApi(open ? '/api/workflow/stages' : null);
  const catalogue = useApi(open && form.budgetHeadId ? `/api/budget-heads/${form.budgetHeadId}/items` : null);

  // Default the financial year to the active one.
  useEffect(() => {
    const active = years.data?.find((y) => y.isActive);
    if (active && !form.financialYearId) setForm((f) => ({ ...f, financialYearId: String(active.id) }));
  }, [years.data, form.financialYearId]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const changeHead = (budgetHeadId) => {
    // Items belong to a head; lines chosen under another head no longer apply.
    set({ budgetHeadId });
    setLines((ls) => ls.map((l) => ({ ...l, budgetItemId: '' })));
  };

  const filled = lines.filter((l) => l.budgetItemId || l.quantity || l.unitCost);
  const totalPaise = filled.reduce((sum, l) => sum + (Number(l.quantity) > 0 && l.unitCost !== '' ? linePaise(l) : 0), 0);
  const total = totalPaise / 100;

  const route = useMemo(() => (stages.data ?? []).find(
    (s) => s.entryRange && total >= s.entryRange.min && (s.entryRange.maxExclusive === null || total < s.entryRange.maxExclusive),
  ), [stages.data, total]);

  const itemById = new Map((catalogue.data ?? []).map((i) => [String(i.id), i]));
  const chosen = filled.map((l) => l.budgetItemId).filter(Boolean);

  const problems = [];
  if (form.title.trim().length < 3) problems.push('Give the request a title (at least 3 characters).');
  if (!form.budgetHeadId) problems.push('Choose a budget head.');
  filled.forEach((l, n) => {
    const label = itemById.get(l.budgetItemId)?.name ?? `Line ${n + 1}`;
    if (!l.budgetItemId) problems.push(`Line ${n + 1}: choose an item.`);
    if (!(Number(l.quantity) > 0)) problems.push(`${label}: quantity must be more than 0.`);
    if (l.unitCost === '' || Number(l.unitCost) < 0) problems.push(`${label}: enter a unit cost.`);
  });
  if (new Set(chosen).size !== chosen.length) problems.push('Each item can appear only once — change the quantity instead.');
  const submitProblems = [...problems, ...(filled.length === 0 ? ['Add at least one item to submit.'] : [])];

  const reset = () => { setForm(blankForm()); setLines([blankLine()]); setFiles([]); setAttempted(null); };
  const close = () => { closeModal('newRequest'); reset(); };

  const save = async (andSubmit) => {
    setAttempted(andSubmit ? 'submit' : 'draft');
    if ((andSubmit ? submitProblems : problems).length) return;
    setSaving(andSubmit ? 'submit' : 'draft');
    let created;
    try {
      created = await api('/api/requests', {
        method: 'POST',
        body: {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          budgetHeadId: Number(form.budgetHeadId),
          financialYearId: form.financialYearId ? Number(form.financialYearId) : undefined,
          departmentId: form.departmentId ? Number(form.departmentId) : null,
          courseId: form.courseId ? Number(form.courseId) : null,
          extra: { urgency: form.urgency },
          items: filled.map((l) => ({
            budgetItemId: Number(l.budgetItemId),
            quantity: Number(l.quantity),
            unitCost: Number(l.unitCost),
            ...(l.remarks.trim() ? { remarks: l.remarks.trim() } : {}),
          })),
        },
      });
    } catch (err) {
      showToast(err.message, 'error');
      setSaving(null);
      return;
    }

    // The request exists from here on. A failed upload or submission leaves it
    // as a draft the person can open and finish, rather than losing their work.
    const failedFiles = [];
    for (const file of files) {
      const upload = new FormData();
      upload.append('file', file);
      try {
        await api(`/api/requests/${created.id}/attachments`, { method: 'POST', form: upload });
      } catch (err) {
        failedFiles.push(`${file.name}: ${err.message}`);
      }
    }

    let message = `Draft ${created.requestNumber} saved`;
    let tone = 'success';
    if (andSubmit) {
      try {
        const submitted = await api(`/api/requests/${created.id}/submit`, { method: 'POST' });
        message = `${created.requestNumber} submitted — now with ${submitted.stage?.name ?? 'the approvers'}`;
      } catch (err) {
        message = `${created.requestNumber} saved as a draft but not submitted: ${err.message}`;
        tone = 'warning';
      }
    }
    if (failedFiles.length) {
      message += `. Not attached — ${failedFiles.join('; ')}`;
      tone = 'warning';
    }

    showToast(message, tone);
    setSaving(null);
    close();
    refresh();
    openRecord('request', created.id);
  };

  const inputCls = 'w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400';
  const labelCls = 'block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5';
  const head = heads.data?.find((h) => String(h.id) === form.budgetHeadId);

  return (
    <Modal isOpen={open} onClose={close} title="New procurement request" subtitle="List each item separately — approvers can approve some lines and cut others." maxWidth="max-w-4xl">
      <div className="space-y-5">
        <div>
          <label htmlFor="req-title" className={labelCls}>Title *</label>
          <input id="req-title" className={inputCls} placeholder="e.g. Seminar hall audio-visual upgrade"
            value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="req-head" className={labelCls}>Budget head *</label>
            <select id="req-head" className={inputCls} value={form.budgetHeadId} onChange={(e) => changeHead(e.target.value)}>
              <option value="">Choose…</option>
              {(heads.data ?? []).map((h) => <option key={h.id} value={h.id}>{h.name} — {h.headType.toLowerCase()}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="req-fy" className={labelCls}>Financial year</label>
            <select id="req-fy" className={inputCls} value={form.financialYearId} onChange={(e) => set({ financialYearId: e.target.value })}>
              {(years.data ?? []).map((y) => <option key={y.id} value={y.id}>FY {y.label}{y.isActive ? ' (current)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="req-urgency" className={labelCls}>Urgency</label>
            <select id="req-urgency" className={inputCls} value={form.urgency} onChange={(e) => set({ urgency: e.target.value })}>
              <option>Low</option><option>Medium</option><option>High</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="req-dept" className={labelCls}>Department</label>
            <select id="req-dept" className={inputCls} value={form.departmentId} onChange={(e) => set({ departmentId: e.target.value, courseId: '' })}>
              <option value="">Not specific to a department</option>
              {(departments.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="req-course" className={labelCls}>Course</label>
            <select id="req-course" className={inputCls} value={form.courseId} disabled={!form.departmentId || !(courses.data ?? []).length}
              onChange={(e) => set({ courseId: e.target.value })}>
              <option value="">{form.departmentId && !(courses.data ?? []).length ? 'No courses listed' : 'None'}</option>
              {(courses.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Line items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={labelCls.replace('mb-1.5', '')}>Items *</span>
            {head && <span className="text-[11px] text-gray-400">Items under {head.name}</span>}
          </div>
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 bg-white">
            {lines.map((l, n) => {
              const item = itemById.get(l.budgetItemId);
              return (
                <div key={l.key} className="p-3 grid grid-cols-12 gap-2 items-end">
                  <label className="col-span-12 md:col-span-5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Item {n + 1}
                    <select className={`${inputCls} mt-1`} value={l.budgetItemId} disabled={!form.budgetHeadId}
                      onChange={(e) => setLine(l.key, { budgetItemId: e.target.value })}>
                      <option value="">{form.budgetHeadId ? 'Choose…' : 'Choose a budget head first'}</option>
                      {(catalogue.data ?? []).map((i) => (
                        <option key={i.id} value={i.id} disabled={chosen.includes(String(i.id)) && l.budgetItemId !== String(i.id)}>
                          {i.name} ({i.itemType.toLowerCase()})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-4 md:col-span-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Qty{item?.unit ? ` (${item.unit})` : ''}
                    <input type="number" min="0.01" step="0.01" className={`${inputCls} mt-1`} value={l.quantity}
                      onChange={(e) => setLine(l.key, { quantity: e.target.value })} />
                  </label>
                  <label className="col-span-4 md:col-span-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Unit cost ₹
                    <input type="number" min="0" step="0.01" className={`${inputCls} mt-1`} value={l.unitCost}
                      onChange={(e) => setLine(l.key, { unitCost: e.target.value })} />
                  </label>
                  <div className="col-span-3 md:col-span-2 text-right text-sm font-bold text-gray-900 tabular-nums pb-2">
                    {Number(l.quantity) > 0 && l.unitCost !== '' ? money(linePaise(l) / 100) : '—'}
                  </div>
                  <div className="col-span-1 text-right pb-1.5">
                    {lines.length > 1 && (
                      <button onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Remove item ${n + 1}`}
                        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                  <input className={`${inputCls} col-span-12 text-xs py-1.5`} placeholder="Specification or note for this item (optional)"
                    value={l.remarks} onChange={(e) => setLine(l.key, { remarks: e.target.value })} />
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button onClick={() => setLines((ls) => [...ls, blankLine()])} disabled={!form.budgetHeadId}
              className="text-xs font-semibold text-indigo-600 flex items-center gap-1 hover:underline disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" /> Add another item
            </button>
            <div className="text-right">
              <span className="text-xs text-gray-500">Estimated total </span>
              <span className="text-lg font-extrabold text-gray-900 tabular-nums">{money(total)}</span>
            </div>
          </div>
          {total > 0 && route && (
            <p className="text-[11px] text-gray-600 flex items-center gap-1.5 justify-end">
              <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
              At this amount the request goes first to <strong className="text-gray-900">{route.name}</strong>.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="req-desc" className={labelCls}>Justification</label>
          <textarea id="req-desc" rows={3} className={inputCls} placeholder="Why these items are needed, and anything approvers should know."
            value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </div>

        <div>
          <span className={labelCls}>Quotations and supporting documents</span>
          <div className="flex flex-wrap items-center gap-2">
            {files.map((f) => (
              <span key={`${f.name}-${f.size}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-xs text-gray-700">
                <Paperclip className="w-3 h-3" /> {f.name}
                <button onClick={() => setFiles((fs) => fs.filter((x) => x !== f))} aria-label={`Remove ${f.name}`} className="text-gray-400 hover:text-red-600"><X className="w-3 h-3" /></button>
              </span>
            ))}
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 cursor-pointer hover:underline">
              <Paperclip className="w-3.5 h-3.5" /> Add file
              <input type="file" multiple accept={ACCEPT} className="hidden"
                onChange={(e) => { setFiles((fs) => [...fs, ...Array.from(e.target.files)]); e.target.value = ''; }} />
            </label>
            <span className="text-[11px] text-gray-400">PDF, image, Word or Excel · up to 10 MB each</span>
          </div>
        </div>

        {attempted && (attempted === 'submit' ? submitProblems : problems).length > 0 && (
          <ul className="text-xs text-red-600 list-disc pl-5 space-y-0.5">
            {(attempted === 'submit' ? submitProblems : problems).map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={close} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">Cancel</button>
          <button type="button" onClick={() => save(false)} disabled={Boolean(saving)}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:border-gray-300 disabled:opacity-50">
            {saving === 'draft' ? 'Saving…' : 'Save as draft'}
          </button>
          <button type="button" onClick={() => save(true)} disabled={Boolean(saving)}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">
            {saving === 'submit' ? 'Submitting…' : 'Submit for approval'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
