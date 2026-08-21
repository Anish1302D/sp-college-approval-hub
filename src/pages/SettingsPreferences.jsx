import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Settings, Shield, Save } from 'lucide-react';

export const SettingsPreferences = () => {
  const { showToast } = useApp();
  const [threshold, setThreshold] = useState('500000');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [autoEscalate, setAutoEscalate] = useState(true);

  const handleSave = (e) => { e.preventDefault(); showToast('Settings saved successfully!', 'success'); };
  const inputCls = "w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400";

  return (
    <div className="space-y-5 max-w-3xl">
      <div><h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2"><Settings className="w-5 h-5 text-indigo-500" /> Settings</h2><p className="text-xs text-gray-500 mt-1">Financial thresholds, escalation rules, and notifications.</p></div>
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
        <div className="space-y-3 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-indigo-500" /><h3 className="text-sm font-bold text-gray-900">Escalation Threshold</h3></div>
          <p className="text-xs text-gray-500">Bills at or above this amount automatically escalate to the SFSP Trust.</p>
          <div className="max-w-xs"><label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Amount (₹)</label><input type="number" className={`${inputCls} font-bold`} value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>
        </div>
        <div className="space-y-4 pb-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-bold text-gray-900">Auto Trust Escalation</p><p className="text-xs text-gray-500">Instantly flag ≥ ₹5L requisitions.</p></div>
            <input type="checkbox" checked={autoEscalate} onChange={(e) => setAutoEscalate(e.target.checked)} className="w-5 h-5 rounded accent-indigo-600 cursor-pointer" />
          </div>
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-bold text-gray-900">Email Notifications</p><p className="text-xs text-gray-500">Send digests to Principal and Trust Board.</p></div>
            <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} className="w-5 h-5 rounded accent-indigo-600 cursor-pointer" />
          </div>
        </div>
        <div className="flex justify-end"><button type="submit" className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 transition-colors"><Save className="w-4 h-4" /> Save</button></div>
      </form>
    </div>
  );
};
