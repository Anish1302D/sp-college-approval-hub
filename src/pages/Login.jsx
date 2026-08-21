import React from 'react';
import { useApp } from '../context/AppContext';
import { Shield, Building, UserCheck, ClipboardList, ArrowRight, Lock } from 'lucide-react';

export const Login = () => {
  const { switchRole } = useApp();

  const roles = [
    { id: 'principal', label: 'Principal Portal', desc: 'Review & approve bills (< ₹5L), resolve issues, escalate ≥ ₹5L.', icon: Shield, color: 'indigo' },
    { id: 'sfsp', label: 'SFSP Trust Authority', desc: 'Governing board for escalated bills (≥ ₹5,00,000).', icon: Building, color: 'amber' },
    { id: 'faculty', label: 'Faculty Portal', desc: 'Submit bill requisitions & non-financial issues.', icon: UserCheck, color: 'emerald' },
    { id: 'admin', label: 'Admin / Clerk Ops', desc: 'Inventory management, purchase bills, exports.', icon: ClipboardList, color: 'violet' },
  ];

  const colorMap = {
    indigo: { bg: 'bg-indigo-50', ring: 'border-indigo-200 hover:border-indigo-400', icon: 'text-indigo-600', text: 'text-indigo-600' },
    amber: { bg: 'bg-amber-50', ring: 'border-amber-200 hover:border-amber-400', icon: 'text-amber-600', text: 'text-amber-600' },
    emerald: { bg: 'bg-emerald-50', ring: 'border-emerald-200 hover:border-emerald-400', icon: 'text-emerald-600', text: 'text-emerald-600' },
    violet: { bg: 'bg-violet-50', ring: 'border-violet-200 hover:border-violet-400', icon: 'text-violet-600', text: 'text-violet-600' },
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between p-6">
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-extrabold text-base">SP</div>
          <div>
            <h1 className="text-base font-extrabold text-gray-900">S.P. College</h1>
            <p className="text-[10px] text-gray-400 font-semibold tracking-widest uppercase">Approval & Workflow Management</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400"><Lock className="w-3.5 h-3.5 text-gray-400" /> Institutional Access</div>
      </div>

      <div className="max-w-4xl w-full mx-auto my-12">
        <div className="text-center mb-10 space-y-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200">Role-Based Access</span>
          <h2 className="text-3xl font-extrabold text-gray-900">Select Your Portal</h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">Choose a role to explore the approval workflow prototype.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {roles.map((role) => {
            const Icon = role.icon;
            const c = colorMap[role.color];
            return (
              <div key={role.id} onClick={() => switchRole(role.id)} className={`bg-white rounded-2xl p-5 cursor-pointer group border ${c.ring} transition-all duration-200 hover:shadow-md flex flex-col justify-between`}>
                <div>
                  <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center ${c.icon} mb-3 group-hover:scale-105 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">{role.label}</h3>
                  <p className="text-xs text-gray-500 mt-1">{role.desc}</p>
                </div>
                <div className={`mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold ${c.text}`}>
                  <span>Enter</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 border-t border-gray-200 pt-4">
        <p>© 2026 S.P. College Autonomous Institution</p>
        <p>Frontend Prototype</p>
      </div>
    </div>
  );
};
