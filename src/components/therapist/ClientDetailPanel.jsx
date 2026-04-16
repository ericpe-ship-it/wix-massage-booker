import React from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, NotebookPen, Star, Calendar, Flag } from 'lucide-react';

export default function ClientDetailPanel({ user, onClose, onEditNote }) {
  if (!user) return null;

  const upcomingBookings = (user.allBookings || [])
    .filter(b => ['booked', 'confirmed'].includes(b.status))
    .sort((a, b) => a.date.localeCompare(b.date));

  const pastBookings = (user.allBookings || [])
    .filter(b => ['completed', 'no_show', 'cancelled', 'late_cancelled'].includes(b.status))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const statusColor = {
    completed: 'bg-gray-100 text-gray-600',
    no_show: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-400',
    late_cancelled: 'bg-orange-100 text-orange-700',
    booked: 'bg-indigo-100 text-indigo-700',
    confirmed: 'bg-green-100 text-green-700',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sticky top-24">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{user.full_name}</h3>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center bg-gray-50 rounded-lg p-2">
          <div className="font-bold text-gray-900">{user.completed}</div>
          <div className="text-xs text-gray-500">Sessions</div>
        </div>
        <div className="text-center bg-red-50 rounded-lg p-2">
          <div className="font-bold text-red-700">{user.noShows}</div>
          <div className="text-xs text-gray-500">No Shows</div>
        </div>
        <div className="text-center bg-amber-50 rounded-lg p-2">
          <div className="font-bold text-amber-700">{user.lateCancels}</div>
          <div className="text-xs text-gray-500">Late Cancel</div>
        </div>
      </div>

      {/* Rating */}
      {user.avgRating && (
        <div className="flex items-center gap-1 mb-4">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="font-medium text-sm">{user.avgRating}</span>
          <span className="text-xs text-gray-400">avg rating</span>
        </div>
      )}

      {/* Therapist Note */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Therapist Note</span>
          <Button size="sm" variant="ghost" onClick={onEditNote} className="h-6 px-2 text-xs">
            <NotebookPen className="w-3 h-3 mr-1" /> {user.note ? 'Edit' : 'Add'}
          </Button>
        </div>
        {user.note ? (
          <p className="text-sm text-gray-700 bg-indigo-50 rounded-lg p-2.5">{user.note.note}</p>
        ) : (
          <p className="text-xs text-gray-400 italic">No notes yet</p>
        )}
      </div>

      {/* Upcoming */}
      {upcomingBookings.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Upcoming</p>
          {upcomingBookings.map(b => (
            <div key={b.id} className="flex items-center justify-between text-sm py-1">
              <span className="text-gray-700">{format(parseISO(b.date), 'MMM d')}</span>
              <Badge className={`text-xs ${statusColor[b.status]}`}>{b.status}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Recent history */}
      {pastBookings.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Recent History</p>
          {pastBookings.map(b => (
            <div key={b.id} className="flex items-center justify-between text-sm py-1">
              <span className="text-gray-500">{format(parseISO(b.date), 'MMM d')}</span>
              <Badge className={`text-xs ${statusColor[b.status]}`}>{b.status.replace('_', ' ')}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}