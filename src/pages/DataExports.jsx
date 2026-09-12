import React, { useState } from 'react';
import { Download, FileDown } from 'lucide-react';
import { download, qs } from '../api/client';
import { DECIDED_STATUSES, REVIEW_STATUSES } from '../api/format';
import { useApp } from '../context/AppContext';
import { useApi } from '../hooks/useApi';

const EXPORTS = [
  { key: 'all', title: 'All requests', desc: 'Every request you can see for the year, with requested and sanctioned amounts.' },
  { key: 'decided', title: 'Decisions', desc: 'Approved, partly approved, rejected and carried-forward requests.', status: DECIDED_STATUSES.join(',') },
  { key: 'review', title: 'Still under review', desc: 'Requests waiting at any approval stage.', status: REVIEW_STATUSES.join(',') },
];

/** Real, downloadable CSV exports — they open in Excel. */
export const DataExports = () => {
  const { showToast } = useApp();
  const years = useApi('/api/financial-years');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(null);

  const run = async (e) => {
    setBusy(e.key);
    try {
      await download(`/api/exports/requests.csv${qs({ financialYearId: year, status: e.status })}`, `${e.key}.csv`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2"><FileDown className="w-5 h-5 text-indigo-500" /> Exports</h2>
          <p className="text-xs text-gray-500 mt-1">CSV spreadsheets that open in Excel. Each contains only what your role can see.</p>
        </div>
        <select aria-label="Financial year" value={year} onChange={(e) => setYear(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs self-start">
          <option value="">All years</option>
          {(years.data ?? []).map((y) => <option key={y.id} value={y.id}>FY {y.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {EXPORTS.map((e) => (
          <div key={e.key} className="bg-white rounded-2xl p-5 border border-gray-200 flex flex-col justify-between gap-4">
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">CSV</span>
              <h3 className="text-sm font-bold text-gray-900 mt-2">{e.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{e.desc}</p>
            </div>
            <button onClick={() => run(e)} disabled={busy !== null}
              className="w-full py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center justify-center gap-2 border border-gray-200 disabled:opacity-50">
              <Download className="w-3.5 h-3.5 text-indigo-500" /> {busy === e.key ? 'Preparing…' : 'Download'}
            </button>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-400">Inventory and issue exports, and formatted PDF reports, are not available yet.</p>
    </div>
  );
};
