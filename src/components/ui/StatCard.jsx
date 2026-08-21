import React from 'react';

export const StatCard = ({ title, value, subtext, icon: Icon, trend, color = 'indigo' }) => {
  const colorMap = {
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', ring: 'ring-indigo-100' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-100' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', ring: 'ring-amber-100' },
    rose: { bg: 'bg-red-50', icon: 'text-red-600', ring: 'ring-red-100' },
    sky: { bg: 'bg-sky-50', icon: 'text-sky-600', ring: 'ring-sky-100' },
  };
  const c = colorMap[color] || colorMap.indigo;

  return (
    <div className="glass-card rounded-2xl p-5 transition-all duration-200 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl ${c.bg} ring-1 ${c.ring}`}>
            <Icon className={`w-5 h-5 ${c.icon}`} />
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
          <span className={trend.positive ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
          <span className="text-gray-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
};
