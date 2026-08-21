import React from 'react';
import { useApp } from '../context/AppContext';
import { BellRing, CheckCircle, ShieldAlert } from 'lucide-react';

export const NotificationsCenter = () => {
  const { notifications, markNotificationRead } = useApp();

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2"><BellRing className="w-5 h-5 text-indigo-500" /> Notifications</h2><p className="text-xs text-gray-500 mt-1">Status updates, escalation alerts, and system notices.</p></div>
      <div className="space-y-2.5">
        {notifications.map((n) => (
          <div key={n.id} onClick={() => markNotificationRead(n.id)} className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${n.read ? 'bg-white border-gray-100 text-gray-400' : 'bg-indigo-50/60 border-indigo-200 text-gray-800'}`}>
            <div className={`p-2.5 rounded-lg shrink-0 ${n.type === 'escalation' ? 'bg-amber-50 text-amber-600' : n.type === 'approval' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
              {n.type === 'escalation' ? <ShieldAlert className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            </div>
            <div className="flex-1 space-y-0.5">
              <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-gray-800">{n.title}</h3><span className="text-[11px] text-gray-400">{n.timestamp}</span></div>
              <p className="text-xs text-gray-500">{n.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
