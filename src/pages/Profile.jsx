import React from 'react';
import { Mail, ShieldCheck, Workflow } from 'lucide-react';
import { initials, roleLabel } from '../api/format';
import { useApp } from '../context/AppContext';

/** Who the system thinks you are, and so what you can see and do. */
export const Profile = () => {
  const { user } = useApp();

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-white rounded-2xl p-5 border border-gray-200 flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-xl font-extrabold">{initials(user.name)}</div>
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">{user.name}</h2>
          <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1"><Mail className="w-3.5 h-3.5" /> {user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-2">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-500" /> Roles</h3>
          {user.roles.length === 0
            ? <p className="text-xs text-gray-500">No role assigned yet. You can log issues; ask the administrator if you need to raise purchase requests.</p>
            : <ul className="text-xs text-gray-700 space-y-1">{user.roles.map((r) => <li key={r}>{roleLabel(r)}</li>)}</ul>}
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-2">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Workflow className="w-4 h-4 text-indigo-500" /> Approval stages you decide at</h3>
          {user.stages.length === 0
            ? <p className="text-xs text-gray-500">None. You can follow requests you raise, but not decide them.</p>
            : <ul className="text-xs text-gray-700 space-y-1">{user.stages.map((s) => <li key={s.stageId}>{s.name}</li>)}</ul>}
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        Roles and stages are set by the college administrator. Documents you attach live on the request or issue they belong to.
      </p>
    </div>
  );
};
