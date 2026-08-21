import React from 'react';
import { useApp } from '../context/AppContext';
import { StatCard } from '../components/ui/StatCard';
import { BarChart3, PieChart, TrendingUp, IndianRupee, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const ReportsAnalytics = () => {
  const { requests } = useApp();
  const deptSpend = [
    { dept: 'Computer Science & Engg', total: 1250000, count: 4, pct: 45 },
    { dept: 'Chemistry Department', total: 345000, count: 3, pct: 15 },
    { dept: 'Physics Department', total: 185000, count: 2, pct: 8 },
    { dept: 'Central Library', total: 420000, count: 2, pct: 18 },
    { dept: 'Cultural & Campus Admin', total: 780000, count: 2, pct: 14 }
  ];

  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-500" /> Reports & Analytics</h2><p className="text-xs text-gray-500 mt-1">Finance analytics, department distribution, and efficiency metrics.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Requisitions" value={requests.length} subtext="Financial & Non-Financial" icon={TrendingUp} color="indigo" />
        <StatCard title="Approval Rate (< ₹5L)" value="85.7%" subtext="< 48h Turnaround" icon={CheckCircle2} color="emerald" />
        <StatCard title="Trust Escalation Rate" value="22.5%" subtext="Board Reviews" icon={ShieldAlert} color="amber" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><PieChart className="w-4 h-4 text-indigo-500" /> Allocation by Department</h3>
        <div className="space-y-3.5">
          {deptSpend.map((d, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs"><span className="font-medium text-gray-700">{d.dept} ({d.count} req.)</span><span className="font-bold text-gray-900">₹{Number(d.total).toLocaleString('en-IN')}</span></div>
              <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${d.pct}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
