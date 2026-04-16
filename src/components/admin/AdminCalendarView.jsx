import React, { useState } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const statusDots = {
  booked: 'bg-indigo-400',
  confirmed: 'bg-green-400',
  completed: 'bg-gray-300',
  no_show: 'bg-red-400',
  cancelled: 'bg-gray-200',
  late_cancelled: 'bg-orange-300',
};

export default function AdminCalendarView({ bookings, massageDates }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const massageDateSet = new Set((massageDates || []).map(d => d.date));

  const bookingsForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return (bookings || []).filter(b => b.date === dateStr && !['cancelled', 'late_cancelled'].includes(b.status));
  };

  const selectedDayBookings = selectedDay ? bookingsForDay(selectedDay) : [];

  const to12 = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // Pad start
  const firstDay = monthStart.getDay();
  const paddingDays = Array(firstDay).fill(null);

  return (
    <div>
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {paddingDays.map((_, i) => <div key={`pad-${i}`} />)}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isMassageDay = massageDateSet.has(dateStr);
          const dayBookings = bookingsForDay(day);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDay(isSameDay(selectedDay, day) ? null : day)}
              className={`rounded-lg p-1.5 text-center min-h-[52px] flex flex-col items-center transition-all ${
                isSelected ? 'bg-indigo-600 text-white' :
                isMassageDay ? 'bg-indigo-50 border border-indigo-200 hover:border-indigo-400' :
                'hover:bg-gray-50'
              }`}
            >
              <span className={`text-sm font-medium ${isToday && !isSelected ? 'text-indigo-600' : ''}`}>
                {format(day, 'd')}
              </span>
              {dayBookings.length > 0 && (
                <div className="flex gap-0.5 flex-wrap justify-center mt-1">
                  {dayBookings.slice(0, 4).map((b, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : (statusDots[b.status] || 'bg-gray-300')}`} />
                  ))}
                  {dayBookings.length > 4 && <span className={`text-xs ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>+{dayBookings.length - 4}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="mt-6">
          <h3 className="font-semibold text-gray-900 mb-3">{format(selectedDay, 'EEEE, MMMM d')}</h3>
          {selectedDayBookings.length === 0 ? (
            <p className="text-gray-400 text-sm">No bookings on this day</p>
          ) : (
            <div className="space-y-2">
              {selectedDayBookings.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(b => (
                <div key={b.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-3 py-2.5">
                  <div>
                    <span className="font-medium text-sm text-gray-900">{b.user_name || b.user_email}</span>
                    <span className="text-xs text-gray-500 ml-2">{to12(b.start_time)}</span>
                  </div>
                  <Badge className={`text-xs ${statusDots[b.status] ? '' : ''}`}>{b.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}