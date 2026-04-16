import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Calendar, Plus, Star, AlertTriangle, Users } from "lucide-react";
import CancellationPolicy from "@/components/booking/CancellationPolicy";
import BookingCard from "@/components/booking/BookingCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function MyBookings() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'upcoming';
  });

  const [cancelDialog, setCancelDialog] = useState({ open: false, booking: null });
  const [feedbackDialog, setFeedbackDialog] = useState({ open: false, booking: null, rating: 0, comment: '' });
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);

    const configs = await base44.entities.ScheduleConfig.list();
    if (configs.length > 0) {
      setConfig(configs[0]);
    }

    const myBookings = await base44.entities.Booking.filter({ user_email: currentUser.email }, 'date');
    setBookings(myBookings);

    const myWaitlist = await base44.entities.Waitlist.filter({ user_email: currentUser.email }, 'date');
    const today = format(new Date(), 'yyyy-MM-dd');
    setWaitlistEntries(myWaitlist.filter(w => ['waiting', 'offered'].includes(w.status) && w.date >= today));

    setLoading(false);
  };

  const handleCancelBooking = async () => {
    setIsCancelling(true);
    const booking = cancelDialog.booking;

    const cutoffMinutes = config?.cancellation_cutoff_minutes || 60;
    const bookingDateTime = new Date(`${booking.date}T${booking.start_time}`);
    const now = new Date();
    const minutesUntilBooking = (bookingDateTime - now) / (1000 * 60);
    const isLateCancellation = config?.late_cancel_penalty_enabled !== false && minutesUntilBooking < cutoffMinutes;

    await base44.entities.Booking.update(booking.id, {
      status: isLateCancellation ? 'late_cancelled' : 'cancelled',
      cancelled_at: new Date().toISOString()
    });

    await base44.functions.invoke('processWaitlist', {
      date: booking.date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      reason: 'manual_cancel'
    });

    toast({
      title: isLateCancellation ? "Late Cancellation" : "Booking Cancelled",
      description: isLateCancellation
        ? "Your booking was cancelled within the cancellation window and has been flagged."
        : "Your massage appointment has been cancelled.",
      variant: isLateCancellation ? "destructive" : "default"
    });

    setCancelDialog({ open: false, booking: null });
    setIsCancelling(false);
    loadData();
  };

  const handleReschedule = (booking) => {
    navigate(createPageUrl('Book') + `?reschedule=${booking.id}`);
  };

  const handleFeedbackSubmit = async () => {
    setIsSubmittingFeedback(true);
    await base44.entities.Booking.update(feedbackDialog.booking.id, {
      feedback_rating: feedbackDialog.rating,
      feedback_comment: feedbackDialog.comment
    });
    toast({ title: "Thank you!", description: "Your feedback has been submitted." });
    setFeedbackDialog({ open: false, booking: null, rating: 0, comment: '' });
    setIsSubmittingFeedback(false);
    loadData();
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  const upcomingBookings = bookings.filter(b => {
    if (!['booked', 'confirmed'].includes(b.status)) return false;
    if (b.date > today) return true;
    if (b.date === today) {
      const [h, m] = b.start_time.split(':').map(Number);
      const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
      return slotTime > now;
    }
    return false;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

  const pastBookings = bookings.filter(b => {
    if (['cancelled', 'late_cancelled', 'no_show', 'completed'].includes(b.status)) return true;
    if (b.date < today) return true;
    if (b.date === today && ['booked', 'confirmed'].includes(b.status)) {
      const [h, m] = b.start_time.split(':').map(Number);
      const slotTime = new Date(); slotTime.setHours(h, m, 0, 0);
      return slotTime <= now;
    }
    return false;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));

  const handleConfirmToday = async (booking) => {
    await base44.entities.Booking.update(booking.id, { status: 'confirmed' });
    toast({ title: "You're confirmed!", description: "See you soon!" });
    loadData();
  };

  const handleAcceptWaitlistOffer = async (entry) => {
    await base44.entities.Booking.create({
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name,
      date: entry.date,
      start_time: entry.offered_slot_start,
      end_time: entry.offered_slot_start,
      status: 'booked'
    });
    await base44.entities.Waitlist.update(entry.id, { status: 'accepted' });
    toast({ title: "Spot confirmed!", description: `Your massage is booked for ${format(parseISO(entry.date), 'MMMM d')} at ${entry.offered_slot_start}` });
    loadData();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => navigate(createPageUrl('Home'))} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your massage appointments</p>
        </div>
        <Button onClick={() => navigate(createPageUrl('Book'))} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" /> Book New
        </Button>
      </div>

      {config && <CancellationPolicy config={config} />}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="upcoming">Upcoming ({upcomingBookings.length})</TabsTrigger>
          <TabsTrigger value="waitlist">Waitlist ({waitlistEntries.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({pastBookings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {upcomingBookings.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-700 mb-2">No upcoming bookings</h3>
              <p className="text-gray-400 text-sm mb-4">Book your next massage session now</p>
              <Button onClick={() => navigate(createPageUrl('Book'))} className="bg-indigo-600 hover:bg-indigo-700">Book a Massage</Button>
            </div>
          ) : (
            upcomingBookings.map(booking => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onCancel={(b) => setCancelDialog({ open: true, booking: b })}
                onReschedule={handleReschedule}
                onConfirmToday={handleConfirmToday}
                cancellationCutoffMinutes={config?.cancellation_cutoff_minutes || 60}
                config={config}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="waitlist">
          {waitlistEntries.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-700 mb-2">No waitlist entries</h3>
              <p className="text-gray-400 text-sm">You're not on any waitlists. If a slot you want is full, you can join its waitlist from the Book page.</p>
            </div>
          ) : (
            waitlistEntries.map(entry => (
              <div key={entry.id} className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{format(parseISO(entry.date), 'EEEE, MMMM d')} at {entry.preferred_time_start}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {entry.status === 'offered' ? `🎉 Slot offered at ${entry.offered_slot_start}` : `Position #${entry.position} in queue`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {entry.status === 'offered' && (
                      <Button size="sm" onClick={() => handleAcceptWaitlistOffer(entry)} className="bg-green-600 hover:bg-green-700">Accept</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={async () => {
                      await base44.entities.Waitlist.update(entry.id, { status: 'declined' });
                      loadData();
                    }}>
                      {entry.status === 'offered' ? 'Decline' : 'Remove'}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="past">
          {pastBookings.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-2">No past bookings</h3>
              <p className="text-gray-400 text-sm">Your booking history will appear here</p>
            </div>
          ) : (
            pastBookings.map(booking => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onFeedback={(b) => setFeedbackDialog({ open: true, booking: b, rating: 0, comment: '' })}
                cancellationCutoffMinutes={config?.cancellation_cutoff_minutes || 60}
                showActions={true}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ ...cancelDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your massage on{' '}
              {cancelDialog.booking && format(parseISO(cancelDialog.booking.date), 'MMMM d')} at{' '}
              {cancelDialog.booking?.start_time}?
            </DialogDescription>
          </DialogHeader>
          {(() => {
            if (!cancelDialog.booking || !config) return null;
            const cutoff = config.cancellation_cutoff_minutes || 60;
            const bookingDT = new Date(`${cancelDialog.booking.date}T${cancelDialog.booking.start_time}`);
            const minsLeft = (bookingDT - new Date()) / (1000 * 60);
            if (minsLeft < cutoff && config.late_cancel_penalty_enabled !== false) {
              return (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  This is within the cancellation window. It will be marked as a <strong>Late Cancellation</strong> on your account.
                </div>
              );
            }
            return null;
          })()}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCancelDialog({ open: false, booking: null })}>Keep Booking</Button>
            <Button variant="destructive" className="flex-1" onClick={handleCancelBooking}>
              {isCancelling ? <LoadingSpinner size="sm" /> : 'Cancel Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialog.open} onOpenChange={(open) => setFeedbackDialog({ ...feedbackDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How was your massage?</DialogTitle>
            <DialogDescription>Your feedback helps us improve our service</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => setFeedbackDialog({ ...feedbackDialog, rating: star })} className="p-1 transition-transform hover:scale-110">
                <Star className={`w-8 h-8 ${star <= feedbackDialog.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
              </button>
            ))}
          </div>
          <textarea
            className="w-full border rounded-lg p-3 text-sm resize-none h-24"
            placeholder="Leave a comment (optional)..."
            value={feedbackDialog.comment}
            onChange={(e) => setFeedbackDialog({ ...feedbackDialog, comment: e.target.value })}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialog({ open: false, booking: null, rating: 0, comment: '' })}>Cancel</Button>
            <Button onClick={handleFeedbackSubmit} disabled={!feedbackDialog.rating} className="bg-indigo-600 hover:bg-indigo-700">
              {isSubmittingFeedback ? <LoadingSpinner size="sm" /> : 'Submit Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}