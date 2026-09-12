import React, { useState } from 'react';
import { BarChart3, CheckCircle2, IndianRupee, TrendingUp } from 'lucide-react';
import { qs } from '../api/client';
import { lakhs, money } from '../api/format';
import { useApi } from '../hooks/useApi';
import { StatCard } from '../components/ui/StatCard';
import { DataState } from '../components/ui/States';

/**
 * Spending by budget head, from real requests. Scoped like everything else:
 * the Principal and administrators see the college, others what they can see.
 */
export const ReportsAnalytics = () => {
  const years = useApi('/api/financial-years');
  const [year, setYear] = useState('');
  const spend = useApi(`/api/reports/by-budget-head${qs({ financialYearId: year })}`);
  const rows = spend.data?.rows ?? [];

  const totals = rows.reduce((t, r) => ({
    requests: t.requests + r.requests,
    approved: t.approved + r.approved,
    rejected: t.rejected + r.rejected,
    requested: t.requested + r.requested,
    sanctioned: t.sanctioned + r.sanctioned,
  }), { requests: 0, approved: 0, rejected: 0, requested: 0, sanctioned: 0 });
  const decided = totals.approved + totals.rejected;
  const max = Math.max(1, ...rows.map((r) => r.requested));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-500" /> Reports</h2>
          <p className="text-xs text-gray-500 mt-1">Submitted requests for FY {spend.data?.financialYear ?? '…'}. Drafts are not counted.</p>
        </div>
        <select aria-label="Financial year" value={year} onChange={(e) => setYear(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs self-start">
          <option value="">Current year</option>
          {(years.data ?? []).map((y) => <option key={y.id} value={y.id}>FY {y.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Requests submitted" value={totals.requests} subtext={`${lakhs(totals.requested)} requested`} icon={TrendingUp} color="indigo" />
        <StatCard title="Sanctioned" value={lakhs(totals.sanctioned)}
          subtext={totals.requested ? `${Math.round((totals.sanctioned / totals.requested) * 100)}% of the amount requested` : 'Nothing requested yet'} icon={IndianRupee} color="emerald" />
        <StatCard title="Approval rate" value={decided ? `${Math.round((totals.approved / decided) * 100)}%` : '—'}
          subtext={decided ? `${totals.approved} approved of ${decided} decided` : 'No decisions yet'} icon={CheckCircle2} color="amber" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900">By budget head</h3>
          <span className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-indigo-200" /> Requested</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-emerald-500" /> Sanctioned</span>
          </span>
        </div>
        <DataState state={spend} isEmpty={rows.length === 0} empty={{ title: 'No submitted requests this year' }}>
          <div className="space-y-4">
            {rows.map((r) => (
              <div key={r.budgetHead.id} className="space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <span className="font-semibold text-gray-800">
                    {r.budgetHead.name}
                    <span className="font-normal text-gray-400"> · {r.budgetHead.headType.toLowerCase()} · {r.requests} request{r.requests === 1 ? '' : 's'}</span>
                  </span>
                  <span className="tabular-nums text-gray-600"><strong className="text-emerald-700">{money(r.sanctioned)}</strong> of {money(r.requested)}</span>
                </div>
                <div className="relative w-full h-2.5 rounded-full bg-gray-100 overflow-hidden" role="img"
                  aria-label={`${r.budgetHead.name}: ${money(r.sanctioned)} sanctioned of ${money(r.requested)} requested`}>
                  <div className="absolute inset-y-0 left-0 bg-indigo-200 rounded-full" style={{ width: `${(r.requested / max) * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full" style={{ width: `${(r.sanctioned / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </DataState>
      </div>
    </div>
  );
};
