import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function CancellationPolicy({ config }) {
  if (!config?.cancellation_policy_text && !config?.cancellation_cutoff_minutes) return null;

  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div>
        {config.cancellation_policy_text || (
          `Free cancellation up to ${config.cancellation_cutoff_minutes} minutes before your session. Late cancellations will be flagged on your account.`
        )}
      </div>
    </div>
  );
}