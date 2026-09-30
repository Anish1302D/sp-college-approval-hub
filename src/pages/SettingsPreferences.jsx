import React from 'react';
import { ArrowRight, GitMerge, Info, Workflow } from 'lucide-react';
import { money } from '../api/format';
import { useApi } from '../hooks/useApi';
import { DataState } from '../components/ui/States';

const STAGE_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500', num: 'bg-blue-100 text-blue-700' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500', num: 'bg-indigo-100 text-indigo-700' },
  { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500', num: 'bg-violet-100 text-violet-700' },
  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500', num: 'bg-purple-100 text-purple-700' },
];

/**
 * The approval route as the system actually runs it — amount thresholds,
 * stage order, and which is the final authority.
 */
export const SettingsPreferences = () => {
  const state = useApi('/api/workflow/stages');
  const stages = state.data ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <Workflow className="w-5 h-5 text-indigo-500" /> Approval route
        </h2>
        <p className="text-xs text-gray-500 mt-1.5 max-w-xl">
          A request enters at the stage whose amount window contains its total. Each stage may approve, partially approve, reject — or escalate to the next stage. The final authority cannot escalate further.
        </p>
      </div>

      <DataState state={state} isEmpty={stages.length === 0} empty={{ title: 'No stages configured' }}>
        {/* Flow diagram */}
        <div className="flex flex-col gap-1">
          {stages.map((s, i) => {
            const c = STAGE_COLORS[i % STAGE_COLORS.length];
            return (
              <div key={s.id}>
                <div className={`flex items-start gap-4 p-4 rounded-xl border ${c.bg} ${c.border}`}>
                  {/* Sequence badge */}
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${c.num}`}>
                    {s.sequence}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${c.text}`}>{s.name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {s.isFinal
                        ? <span className="flex items-center gap-1"><GitMerge className="w-3 h-3 text-purple-500" /> Final authority — no further escalation possible</span>
                        : 'Can approve, partially approve, reject, or escalate to the next stage'}
                    </p>
                  </div>
                  <div className="text-right shrink-0 text-xs tabular-nums text-gray-600">
                    {s.entryRange
                      ? s.entryRange.maxExclusive === null
                        ? <><span className="text-gray-400">from </span><strong>{money(s.entryRange.min)}</strong><span className="text-gray-400"> and above</span></>
                        : <><span className="text-gray-400">from </span><strong>{money(s.entryRange.min)}</strong><span className="text-gray-400"> to under </span><strong>{money(s.entryRange.maxExclusive)}</strong></>
                      : <span className="text-gray-400 flex items-center gap-1"><ArrowRight className="w-3 h-3" /> Reached by escalation only</span>}
                  </div>
                </div>
                {/* Connector arrow */}
                {i < stages.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowRight className="w-4 h-4 text-gray-300 rotate-90" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info footer */}
        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>To change an amount threshold or stage configuration, ask the administrator to update the routing rules in the database.</p>
        </div>
      </DataState>
    </div>
  );
};
