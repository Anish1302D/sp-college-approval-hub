import React from 'react';

export const StatusBadge = ({ status }) => {
  const getBadgeStyle = () => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'resolved':
      case 'released':
      case 'approved & released':
      case 'paid & archived':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
      case 'pending approval':
      case 'pending':
      case 'under review':
      case 'in review':
        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
      case 'escalated to sfsp trust':
      case 'escalated':
        return 'bg-violet-50 text-violet-700 ring-1 ring-violet-200';
      case 'rejected':
      case 'critical maintenance needed':
        return 'bg-red-50 text-red-700 ring-1 ring-red-200';
      case 'in use':
      case 'good':
        return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200';
      case 'needs maintenance':
      case 'under repair':
        return 'bg-orange-50 text-orange-700 ring-1 ring-orange-200';
      default:
        return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${getBadgeStyle()}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
      {status}
    </span>
  );
};
