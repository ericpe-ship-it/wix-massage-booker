import React from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const to12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export default function SlotPicker({ massageDates, selectedDate, onDateSelect, slots, slotsLoading, onSlotSelect, userBookings, limitError, config }) {
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;

  const myBookingForDate = (dateStr) => userBookings?.find(b => b.date === dateStr);

  return (
    <div className="space-y-6">
      {/* Date selector */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Select a Date</h2>
        {massageDates.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-gray-100 text-gray-400">
            <Calendar className="w-8 h-8 mx-auto mb-2" />
            <p>No upcoming massage dates available</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {massageDates.map(dateStr => {
              const isSelected = dateStr === selectedDateStr;
              const myB = myBookingForDate(dateStr);
              return (
                <button
                  key={dateStr}
                  onClick={() => onDateSelect(new Date(dateStr + 'T12:00:00'))}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100'
                      : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'
                  }`}
                >
                  <div className="text-xs text-gray-500">{format(parseISO(dateStr), 'EEE')}</div>
                  <div className="font-semibold text-gray-900">{format(parseISO(dateStr), 'MMM d')}</div>
                  {myB && <div className="text-xs text-indigo-600 font-medium mt-0.5">✓ {to12(myB.start_time)}</div>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Slot selector */}
      {selectedDate && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Select a Time</h2>
          {slotsLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border border-gray-100 text-gray-400">
              <p>No available slots for this date</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map(slot => {
                const myB = myBookingForDate(selectedDateStr);
                const isMySlot = myB?.start_time === slot.start_time;
                const isBookable = !slot.is_booked && !slot.is_break && !myB && !limitError;

                return (
                  <button
                    key={slot.start_time}
                    onClick={() => isBookable && onSlotSelect(slot)}
                    disabled={!isBookable}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      isMySlot
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : slot.is_break
                        ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
                        : slot.is_booked
                        ? 'bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed'
                        : isBookable
                        ? 'bg-white border-gray-200 text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer'
                        : 'bg-white border-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <div className="font-semibold text-sm">{to12(slot.start_time)}</div>
                    <div className="text-xs mt-0.5 opacity-75">
                      {isMySlot ? '✓ Mine'
                        : slot.is_break ? 'Break'
                        : slot.is_booked ? (slot.booked_by_name || 'Taken')
                        : 'Open'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}