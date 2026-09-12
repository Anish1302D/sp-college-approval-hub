import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RequestTable } from '../components/requests/RequestTable';

/** Requests sitting at a stage this person is staffed at, waiting for them. */
export const ReviewQueue = () => {
  const { user } = useApp();
  const stages = user.stages.map((s) => s.name).join(' and ');

  return (
    <div className="space-y-5">
      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700"><ClipboardCheck className="w-5 h-5" /></div>
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Awaiting my decision</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            {/* Which actions are offered depends on the stage — the final
                authority cannot escalate — so the wording stays general. */}
            {stages ? `Requests now with ${stages}. Open one to record your decision.` : 'You are not staffed at any approval stage.'}
          </p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <RequestTable query={{ awaitingMe: true }} empty={{ title: 'Nothing waiting on you', hint: 'New requests at your stage appear here, and you are notified when they arrive.' }} />
      </div>
    </div>
  );
};
