import React from 'react';
import { FolderArchive } from 'lucide-react';
import { DECIDED_STATUSES } from '../api/format';
import { RequestTable } from '../components/requests/RequestTable';

/** Decided requests this person can see — each with its sealed history. */
export const DecisionsArchive = () => (
  <div className="space-y-5">
    <div>
      <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2"><FolderArchive className="w-5 h-5 text-violet-500" /> Decided requests</h2>
      <p className="text-xs text-gray-500 mt-1">Approved, partly approved, rejected and carried-forward requests. Each decision in a request's history shows whether its record is still exactly as sealed.</p>
    </div>
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <RequestTable query={{ status: DECIDED_STATUSES.join(',') }} empty={{ title: 'No decisions yet' }} />
    </div>
  </div>
);
