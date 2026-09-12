import React from 'react';
import { Workflow } from 'lucide-react';
import { money } from '../api/format';
import { useApi } from '../hooks/useApi';
import { DataState } from '../components/ui/States';

/**
 * The approval route as the system actually runs it: where each amount enters,
 * and the order escalation follows. Changing a threshold is a database change
 * the administrator makes; nothing here pretends otherwise.
 */
export const SettingsPreferences = () => {
  const state = useApi('/api/workflow/stages');
  const stages = state.data ?? [];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2"><Workflow className="w-5 h-5 text-indigo-500" /> Approval route</h2>
        <p className="text-xs text-gray-500 mt-1">
          A request starts at the stage its total belongs to. Each stage can approve, partly approve or reject it,
          or escalate it to the next stage — except the last, whose decision is final.
        </p>
      </div>
      <DataState state={state} isEmpty={stages.length === 0} empty={{ title: 'No stages configured' }}>
        <ol className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {stages.map((s) => (
            <li key={s.id} className="p-4 grid grid-cols-[2rem_1fr_auto] gap-3 items-center">
              <span className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center tabular-nums">{s.sequence}</span>
              <span>
                <span className="block text-sm font-bold text-gray-900">{s.name}</span>
                <span className="block text-[11px] text-gray-500">{s.isFinal ? 'Final authority — no further escalation' : 'Can escalate to the next stage'}</span>
              </span>
              <span className="text-right text-xs tabular-nums text-gray-700">
                {s.entryRange
                  ? s.entryRange.maxExclusive === null
                    ? <>Requests of <strong>{money(s.entryRange.min)}</strong> and above</>
                    : <>Requests from <strong>{money(s.entryRange.min)}</strong> to under <strong>{money(s.entryRange.maxExclusive)}</strong></>
                  : <span className="text-gray-400">Reached by escalation only</span>}
              </span>
            </li>
          ))}
        </ol>
      </DataState>
      <p className="text-[11px] text-gray-400">To change a threshold, ask the administrator to update the routing rules in the database.</p>
    </div>
  );
};
