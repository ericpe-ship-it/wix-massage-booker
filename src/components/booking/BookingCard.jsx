import React from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Star, X, RefreshCw, Check } from 'lucide-react';
import CalendarIndicator from '@/components/therapist/CalendarIndicator';

const to12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const statusColors = {
  booked: 'bg-indigo-100 text-indigo-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  no_show: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
  late_cancelled: 'bg-orange-100 text-orange-700',
};

const statusLabels = {
  booked: 'Booked',
  confirmed: 'Confirmed',
  completed: 'Completed',
  no_show: 'No Show',
  cancelled: 'Cancelled',
  late_cancelled: 'Late Cancel',
};

export default function BookingCard({ booking, onCancel, onReschedule, onFeedback, onConfirmToday, cancellationCutoffMinutes = 60, config, showActions = true }) {
  const isUpcoming = ['booked', 'confirmed'].includes(booking.status);
  const isPast = ['completed', 'cancelled', 'late_cancelled', 'no_show'].includes(booking.status);
  const hasFeedback = booking.feedback_rating || booking.feedback_comment;

  // Is it today?
  const today = new Date().toISOString().split('T')[0];
  const isToday = booking.date === today;
  const canConfirmToday = isToday && booking.status === 'booked' && onConfirmToday;

  // Can cancel?
  const bookingDT = new Date(`${booking.date}T${booking.start_time}`);
  const minsUntil = (bookingDT - new Date()) / (1000 * 60);
  const canCancel = isUpcoming && minsUntil > 0;
  const isLateCancelRisk = minsUntil < (cancellationCutoffMinutes || 60) && minsUntil > 0 && config?.late_cancel_penalty_enabled !== false;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">
              {format(parseISO(booking.date), 'EEEE, MMMM d')}
            </span>
            <Badge className={statusColors[booking.status] || 'bg-gray-100 text-gray-600'}>
              {statusLabels[booking.status] || booking.status}
            </Badge>
            <CalendarIndicator booking={booking} size="sm" />
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
            <Clock className="w-3.5 h-3.5" />
            {to12(booking.start_time)} – {to12(booking.end_time)}
          </div>
          {booking.notes && (
            <p className="text-xs text-gray-500 mt-1.5 italic">"{booking.notes}"</p>
          )}
          {isPast && hasFeedback && (
            <div className="flex items-center gap-1 mt-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-3.5 h-3.5 ${i < booking.feedback_rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
              ))}
              {booking.feedback_comment && (
                <span className="text-xs text-gray-500 ml-1">"{booking.feedback_comment}"</span>
              )}
            </div>
          )}
        </div>

        {showActions && (
          <div className="flex flex-col gap-1.5 items-end">
            {canConfirmToday && (
              <Button size="sm" onClick={() => onConfirmToday(booking)} className="bg-green-600 hover:bg-green-700 text-xs h-7 px-2">
                <Check className="w-3 h-3 mr-1" /> Confirm Attendance
              </Button>
            )}
            {canCancel && onCancel && (
              <Button size="sm" variant="outline" onClick={() => onCancel(booking)} className={`text-xs h-7 px-2 ${isLateCancelRisk ? 'border-orange-300 text-orange-600' : 'text-red-500 border-red-200'}`}>
                <X className="w-3 h-3 mr-1" /> Cancel
              </Button>
            )}
            {onReschedule && isUpcoming && (
              <Button size="sm" variant="outline" onClick={() => onReschedule(booking)} className="text-xs h-7 px-2">
                <RefreshCw className="w-3 h-3 mr-1" /> Reschedule
              </Button>
            )}
            {isPast && booking.status === 'completed' && !hasFeedback && onFeedback && (
              <Button size="sm" variant="outline" onClick={() => onFeedback(booking)} className="text-xs h-7 px-2">
                <Star className="w-3 h-3 mr-1" /> Leave Feedback
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}