import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { format, addMinutes, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, AlertCircle, Users } from "lucide-react";
import SlotPicker from "@/components/booking/SlotPicker";
import BookingConfirmation from "@/components/booking/BookingConfirmation";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const to12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
};

export default function Book() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [userBookings, setUserBookings] = useState([]);
  const [massageDates, setMassageDates] = useState([]);

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [limitError, setLimitError] = useState(null);
  const [userWaitlist, setUserWaitlist] = useState([]);
  const [joiningWaitlist, setJoiningWaitlist] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedDate && config) {
      loadSlotsForDate(selectedDate);
      checkBookingLimits(selectedDate);
    }
  }, [selectedDate, config, userBookings]);

  const loadInitialData = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);

    const configs = await base44.entities.ScheduleConfig.list();
    if (configs.length > 0) {
      setConfig(configs[0]);
    }

    const allExceptions = await base44.entities.ScheduleException.list();
    setExceptions(allExceptions);

    const today = format(new Date(), 'yyyy-MM-dd');
    const rawDates = await base44.entities.MassageDate.filter({ is_active: true }, 'date', 200);
    const dates = rawDates.map(d => d.date).filter(d => d >= today).sort();
    setMassageDates(dates);

    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    if (dateParam && dates.includes(dateParam)) {
      setSelectedDate(new Date(dateParam + 'T12:00:00'));
    }

    const myBookings = await base44.entities.Booking.filter({ user_email: currentUser.email });
    setUserBookings(myBookings.filter(b => ['booked', 'confirmed'].includes(b.status)));

    const myWaitlist = await base44.entities.Waitlist.filter({ user_email: currentUser.email });
    setUserWaitlist(myWaitlist.filter(w => ['waiting', 'offered'].includes(w.status)));

    setLoading(false);
  };

  const checkBookingLimits = (date) => {
    if (!config || !user) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const activeBookings = userBookings.filter(b =>
      ['booked', 'confirmed'].includes(b.status) && b.date >= format(new Date(), 'yyyy-MM-dd')
    );

    const dailyBookings = activeBookings.filter(b => b.date === dateStr);
    if (dailyBookings.length >= config.max_bookings_per_day) {
      setLimitError(`You already have a booking on this day. Maximum ${config.max_bookings_per_day} per day.`);
      return;
    }

    const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 0 });
    const weeklyBookings = activeBookings.filter(b => {
      const bDate = parseISO(b.date);
      return bDate >= weekStart && bDate <= weekEnd;
    });

    if (weeklyBookings.length >= config.max_bookings_per_week) {
      setLimitError(`You've reached your weekly limit of ${config.max_bookings_per_week} booking(s).`);
      return;
    }

    setLimitError(null);
  };

  const loadSlotsForDate = async (date) => {
    setSlotsLoading(true);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = date.getDay();

    if (!massageDates.includes(dateStr)) {
      setSlots([]);
      setSlotsLoading(false);
      return;
    }

    const freshExceptions = await base44.entities.ScheduleException.list();

    const closedException = freshExceptions.find(e =>
      e.date === dateStr && e.exception_type === 'closed'
    );

    if (closedException) {
      setSlots([]);
      setSlotsLoading(false);
      return;
    }

    const modifiedHours = freshExceptions.find(e =>
      e.date === dateStr && e.exception_type === 'modified_hours'
    );

    const startTime = modifiedHours?.start_time || config.start_time;
    const endTime = modifiedHours?.end_time || config.end_time;

    const breaks = freshExceptions
      .filter(e =>
        (e.exception_type === 'break' || e.exception_type === 'blocked') && (
          e.date === dateStr ||
          (e.is_recurring && e.recurring_days?.includes(dayOfWeek))
        )
      )
      .map(e => ({
        ...e,
        start_time: e.start_time?.trim() || '',
        end_time: e.end_time?.trim() || ''
      }));

    const dayBookings = await base44.entities.Booking.filter({ date: dateStr });
    setBookings(dayBookings);

    const generatedSlots = generateTimeSlots(startTime, endTime, breaks, dayBookings);
    setSlots(generatedSlots);
    setSlotsLoading(false);
  };

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.trim().split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  };

  const generateTimeSlots = (startTime, endTime, breaks, existingBookings) => {
    const slots = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let currentTime = new Date();
    currentTime.setHours(startHour, startMin, 0, 0);
    const endDateTime = new Date();
    endDateTime.setHours(endHour, endMin, 0, 0);

    const slotDuration = config.slot_duration_minutes;
    const buffer = config.buffer_minutes;

    while (currentTime < endDateTime) {
      const slotStart = format(currentTime, 'HH:mm');
      const slotEndTime = addMinutes(currentTime, slotDuration);
      const slotEnd = format(slotEndTime, 'HH:mm');

      const slotStartMin = timeToMinutes(slotStart);
      const slotEndMin = timeToMinutes(slotEnd);

      const breakOverlap = breaks.find(b => {
        const breakStartMin = timeToMinutes(b.start_time);
        const breakEndMin = timeToMinutes(b.end_time);
        return slotStartMin < breakEndMin && slotEndMin > breakStartMin;
      });

      const bookedBooking = existingBookings.find(b =>
        b.start_time === slotStart && ['booked', 'confirmed'].includes(b.status)
      );
      const isBooked = !!bookedBooking;

      if (slotEndTime <= endDateTime) {
        if (breakOverlap) {
          slots.push({
            start_time: slotStart,
            end_time: slotEnd,
            is_break: true,
            break_reason: breakOverlap.reason,
            is_booked: false
          });
        } else {
          slots.push({
            start_time: slotStart,
            end_time: slotEnd,
            is_booked: isBooked,
            booked_by_name: bookedBooking ? (bookedBooking.user_name?.split(' ')[0] || bookedBooking.user_email) : null
          });
        }
      }

      currentTime = addMinutes(currentTime, slotDuration + buffer);
    }

    return slots;
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot) => {
    if (limitError) return;
    setSelectedSlot(slot);
    setShowConfirmation(true);
  };

  const handleJoinWaitlist = async () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setJoiningWaitlist(dateStr);
    const res = await base44.functions.invoke('joinWaitlist', { date: dateStr });

    if (res.data?.error) {
      toast({ title: 'Could not join waitlist', description: res.data.error, variant: 'destructive' });
    } else {
      toast({ title: "You're on the waitlist!", description: `We'll notify you via Slack when a slot opens up.` });
      const myWaitlist = await base44.entities.Waitlist.filter({ user_email: user.email });
      setUserWaitlist(myWaitlist.filter(w => ['waiting', 'offered'].includes(w.status)));
    }
    setJoiningWaitlist(null);
  };

  const handleConfirmBooking = async (notes) => {
    setIsBooking(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const latestBookings = await base44.entities.Booking.filter({ date: dateStr, start_time: selectedSlot.start_time });
    const slotTaken = latestBookings.some(b =>
      ['booked', 'confirmed'].includes(b.status) && b.user_email !== user.email
    );

    if (slotTaken) {
      toast({
        title: "Slot no longer available",
        description: "Someone else just booked this slot. Please choose a different time.",
        variant: "destructive"
      });
      setIsBooking(false);
      setShowConfirmation(false);
      setSelectedSlot(null);
      await loadSlotsForDate(selectedDate);
      return;
    }

    const booking = {
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name,
      date: dateStr,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      status: 'booked',
      notes: notes || '',
      booked_by_admin: false,
      admin_override: false
    };

    await base44.entities.Booking.create(booking);

    toast({
      title: "Booking confirmed!",
      description: `Your massage is booked for ${format(selectedDate, 'MMMM d')} at ${to12(selectedSlot.start_time)}`
    });

    setIsBooking(false);
    setShowConfirmation(false);
    setSelectedSlot(null);
    await loadInitialData();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const isFullyBooked = slots.length > 0 && slots.every(s => s.is_booked || s.is_break);
  const userWaitlistForDate = selectedDate
    ? userWaitlist.find(w => w.date === format(selectedDate, 'yyyy-MM-dd'))
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => navigate(createPageUrl('Home'))} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </Button>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Book a Massage</h1>
      <p className="text-gray-500 mb-8">Select a date and time for your session</p>

      {limitError && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 mb-6 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {limitError}
        </div>
      )}

      <SlotPicker
        massageDates={massageDates}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        slots={slots}
        slotsLoading={slotsLoading}
        onSlotSelect={handleSlotSelect}
        userBookings={userBookings}
        limitError={limitError}
        config={config}
      />

      {selectedDate && isFullyBooked && config?.waitlist_enabled && !userWaitlistForDate && (
        <div className="mt-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-800">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">This date is fully booked</span>
          </div>
          <Button
            size="sm"
            onClick={handleJoinWaitlist}
            disabled={!!joiningWaitlist}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {joiningWaitlist ? <LoadingSpinner size="sm" /> : 'Join Waitlist'}
          </Button>
        </div>
      )}

      {userWaitlistForDate && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 text-sm">
          ✓ You're on the waitlist for this date. We'll notify you via Slack if a slot opens up.
        </div>
      )}

      {showConfirmation && selectedSlot && (
        <BookingConfirmation
          slot={selectedSlot}
          date={selectedDate}
          onConfirm={handleConfirmBooking}
          onCancel={() => { setShowConfirmation(false); setSelectedSlot(null); }}
          isLoading={isBooking}
        />
      )}
    </div>
  );
}