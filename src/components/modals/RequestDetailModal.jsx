import React from 'react';
import { Building2, Calendar, CornerDownRight, Layers, User } from 'lucide-react';
import { api } from '../../api/client';
import { date, money } from '../../api/format';
import { useApp } from '../../context/AppContext';
import { useApi, useAction } from '../../hooks/useApi';
import { Attachments } from '../ui/Attachments';
import { Modal } from '../ui/Modal';
import { ErrorState, Loading } from '../ui/States';
import { StatusBadge } from '../ui/StatusBadge';
import { CarryForward } from '../requests/CarryForward';
import { Comments } from '../requests/Comments';
import { DecisionPanel } from '../requests/DecisionPanel';
import { DraftPanel } from '../requests/DraftPanel';
import { ItemsTable } from '../requests/ItemsTable';
import { Timeline } from '../requests/Timeline';

const Section = ({ title, children }) => (
  <section className="space-y-2">
    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</h4>
    {children}
  </section>
);

const DECIDED = ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'FULFILMENT_PENDING', 'FULFILLED', 'CLOSED', 'CARRIED_FORWARD'];

export const RequestDetailModal = () => {
  const { openRecordState, closeRecord, openRecord, user } = useApp();
  const id = openRecordState?.kind === 'request' ? openRecordState.id : null;
  const state = useApi(id ? `/api/requests/${id}` : null);
  const { run } = useAction();
  const r = state.data;

  const removeItem = (item) =>
    run(() => api(`/api/requests/${r.id}/items/${item.id}`, { method: 'DELETE' }), `Removed ${item.budgetItem.name}`);

  return (
    <Modal
      isOpen={Boolean(id)}
      onClose={closeRecord}
      title={r ? `${r.requestNumber} — ${r.title}` : 'Request'}
      subtitle={r ? `${r.budgetHead.name} · FY ${r.financialYear.label}` : undefined}
      maxWidth="max-w-5xl"
    >
      {state.loading && !r && <Loading />}
      {state.error && (
        <ErrorState error={state.error.status === 404 ? { message: 'This request doesn\'t exist, or you don\'t have access to it.' } : state.error} />
      )}
      {r && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={r.status} />
                <span className="text-[11px] font-semibold text-gray-500 capitalize">{r.budgetHead.headType.toLowerCase()} budget</span>
              </div>
              {r.extra?.urgency && <p className="text-[11px] text-gray-500">Urgency: <span className="font-semibold text-gray-700">{r.extra.urgency}</span></p>}
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Requested</span>
                <span className="text-xl font-extrabold text-gray-900 tabular-nums">{money(r.tentativeTotalCost)}</span>
              </div>
              {DECIDED.includes(r.status) && r.status !== 'REJECTED' && (
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Sanctioned</span>
                  <span className="text-xl font-extrabold text-emerald-700 tabular-nums">{money(r.sanctionedAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {r.carriedForwardFrom && (
            <button onClick={() => openRecord('request', r.carriedForwardFrom.requestId)}
              className="w-full text-left p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-800 flex items-center gap-2 hover:bg-sky-100">
              <CornerDownRight className="w-4 h-4" />
              Carried forward from FY {r.carriedForwardFrom.financialYear}
              {r.carriedForwardFrom.requestNumber ? ` (${r.carriedForwardFrom.requestNumber})` : ''} — its full history stays on the original.
            </button>
          )}

          {r.permissions.canAct && <DecisionPanel key={`${r.id}-${r.status}`} request={r} />}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { icon: User, label: 'Raised by', value: r.raisedBy.name },
              { icon: Building2, label: 'Department', value: r.department?.name ?? '—', sub: r.course?.name },
              { icon: Calendar, label: 'Submitted', value: r.submittedAt ? date(r.submittedAt) : 'Not yet' },
              { icon: Layers, label: 'Now with', value: r.stage && r.status.startsWith('UNDER_') ? r.stage.name : '—' },
            ].map((f) => (
              <div key={f.label} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-gray-400 flex items-center gap-1.5 mb-1"><f.icon className="w-3.5 h-3.5 text-indigo-500" /> {f.label}</span>
                <p className="font-semibold text-gray-800">{f.value}</p>
                {f.sub && <p className="text-[10px] text-gray-400">{f.sub}</p>}
              </div>
            ))}
          </div>

          <Section title={`Items (${r.items.length})`}>
            {r.items.length === 0
              ? <p className="text-xs text-gray-400">No items yet — add at least one before submitting.</p>
              : <ItemsTable items={r.items} decided={r.items.some((i) => i.status !== 'PENDING')} onRemove={r.permissions.canEdit ? removeItem : undefined} />}
          </Section>

          {r.permissions.canEdit && <DraftPanel request={r} />}

          {r.description && (
            <Section title="Justification">
              <p className="p-3.5 rounded-lg bg-gray-50 border border-gray-100 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{r.description}</p>
            </Section>
          )}

          <Section title="Documents">
            <Attachments
              files={r.attachments}
              uploadPath={r.permissions.canAttach ? `/api/requests/${r.id}/attachments` : null}
              canDelete={(f) => r.status === 'DRAFT' && (f.uploadedBy.id === user.id || user.roles.includes('ADMIN'))}
            />
          </Section>

          {r.permissions.canCarryForward && r.status !== 'DRAFT' && <CarryForward request={r} />}

          <Section title="History">
            <Timeline requestId={r.id} />
          </Section>

          {r.status !== 'DRAFT' && (
            <Section title="Comments">
              <Comments requestId={r.id} canRestrict={user.stages.length > 0} />
            </Section>
          )}
        </div>
      )}
    </Modal>
  );
};
