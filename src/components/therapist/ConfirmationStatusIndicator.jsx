import React from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function ConfirmationStatusIndicator({ booking, size = 'default' }) {
  if (!booking) return null;

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  if (booking.status === 'confirmed') {
    return (
      <span title="Attendance confirmed" className="inline-flex items-center text-green-500">
        <CheckCircle className={iconSize} />
      </span>
    );
  }

  if (booking.status === 'booked') {
    // Check if it's today and they haven't confirmed yet
    const today = new Date().toISOString().split('T')[0];
    if (booking.date === today) {
      return (
        <span title="Awaiting day-of confirmation" className="inline-flex items-center text-amber-500">
          <Clock className={iconSize} />
        </span>
      );
    }
  }

  return null;
}