import React, { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const to12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
};

export default function BookingConfirmation({ slot, date, onConfirm, onCancel, isLoading }) {
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    onConfirm(notes);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Your Booking</DialogTitle>
          <DialogDescription>
            {date && format(date, 'EEEE, MMMM d, yyyy')} at {to12(slot?.start_time)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-indigo-50 rounded-lg p-4 text-sm text-indigo-800">
            <p className="font-semibold mb-1">Session Details</p>
            <p>{to12(slot?.start_time)} – {to12(slot?.end_time)}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Note for therapist (optional)</label>
            <Textarea
              className="mt-1 resize-none h-20"
              placeholder="e.g. Focus on neck and shoulders..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
            {isLoading ? <LoadingSpinner size="sm" /> : 'Confirm Booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}