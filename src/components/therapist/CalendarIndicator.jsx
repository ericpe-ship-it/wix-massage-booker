import React from 'react';
import { Calendar, Check, X } from 'lucide-react';

export default function CalendarIndicator({ booking, size = 'default' }) {
  if (!booking?.calendar_event_id) return null;

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  if (booking.calendar_accepted === true) {
    return (
      <span title="Calendar invite accepted" className="inline-flex items-center gap-0.5 text-green-500">
        <Calendar className={iconSize} />
        <Check className="w-2.5 h-2.5" />
      </span>
    );
  }

  if (booking.calendar_accepted === false) {
    return (
      <span title="Calendar invite declined" className="inline-flex items-center gap-0.5 text-red-400">
        <Calendar className={iconSize} />
        <X className="w-2.5 h-2.5" />
      </span>
    );
  }

  return (
    <span title="Calendar invite sent" className="inline-flex items-center text-blue-400">
      <Calendar className={iconSize} />
    </span>
  );
}