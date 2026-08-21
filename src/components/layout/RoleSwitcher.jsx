import React from 'react';
import { useApp } from '../../context/AppContext';
import { Shield, UserCheck, Building, ClipboardList } from 'lucide-react';

export const RoleSwitcher = () => {
  const { currentRole, switchRole } = useApp();

  const roles = [
    { id: 'principal', label: 'Principal', icon: Shield },
    { id: 'sfsp', label: 'SFSP Trust', icon: Building },
    { id: 'faculty', label: 'Faculty', icon: UserCheck },
    { id: 'admin', label: 'Admin Clerk', icon: ClipboardList },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
      {roles.map((role) => {
        const Icon = role.icon;
        const isActive = currentRole === role.id;
        return (
          <button
            key={role.id}
            onClick={() => switchRole(role.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              isActive
                ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{role.label}</span>
          </button>
        );
      })}
    </div>
  );
};
