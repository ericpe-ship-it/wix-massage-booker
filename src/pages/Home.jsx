import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, ArrowRight, Heart, User, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { createPageUrl } from "@/utils";
import { base44 } from '@/api/base44Client';
import { format, startOfDay, isBefore, parseISO, addMinutes, parse } from "date-fns";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import CalendarIndicator from '../components/therapist/CalendarIndicator';
import ConfirmationStatusIndicator from '../components/therapist/ConfirmationStatusIndicator';
import BookingConfirmation from '../components/booking/BookingConfirmation';
import { useToast } from "@/components/ui/use-toast";

const to12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
};

export default function Home() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [allBookings, setAllBookings] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [massageDates, setMassageDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [therapistBio, setTherapistBio] = useState(null);
  const [nextDateSlots, setNextDateSlots] = useState([]);
  const [exceptions, setExceptions] = useState({});
  const [expandedDates, setExpandedDates] = useState({});
  const [dateSlots, setDateSlots] = useState({});
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedSlotDate, setSelectedSlotDate] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const generateSlots = (cfg, bookingsForDate, dateStr, breaksForDate) => {
    if (!cfg) return [];
    const slots = [];
    const [sh, sm] = cfg.start_time.split(':').map(Number);
    const [eh, em] = cfg.end_time.split(':').map(Number);
    let current = new Date();
    current.setHours(sh, sm, 0, 0);
    const end = new Date();
    end.setHours(eh, em, 0, 0);

    const timeToMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    while (current < end) {
      const startStr = format(current, 'HH:mm');
      const slotEnd = addMinutes(current, cfg.slot_duration_minutes);
      if (slotEnd <= end) {
        const booking = bookingsForDate.find(
          b => b.start_time === startStr && ['booked', 'confirmed'].includes(b.status)
        );

        const slotStartMin = timeToMinutes(startStr);
        const slotEndMin = timeToMinutes(format(slotEnd, 'HH:mm'));
        const overlappingBreak = breaksForDate.find(e => {
          const breakStartMin = timeToMinutes(e.start_time);
          const breakEndMin = timeToMinutes(e.end_time);
          return slotStartMin < breakEndMin && slotEndMin > breakStartMin;
        });

        slots.push({
          start_time: startStr,
          end_time: format(slotEnd, 'HH:mm'),
          booking: booking || null,
          isBreak: !!overlappingBreak,
          breakReason: overlappingBreak?.reason
        });
      }
      current = addMinutes(current, cfg.slot_duration_minutes + (cfg.buffer_minutes || 0));
    }
    return slots;
  };

  const loadData = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);

    const [configs, rawDates, bookings, mine, bios, allExceptions] = await Promise.all([
      base44.entities.ScheduleConfig.list(),
      base44.entities.MassageDate.filter({ is_active: true }, 'date', 200),
      base44.entities.Booking.list('date', 500),
      base44.entities.Booking.filter({ user_email: currentUser.email }, 'date', 50),
      base44.entities.TherapistBio.list(),
      base44.entities.ScheduleException.list()
    ]);

    const exceptionsMap = {};
    allExceptions.filter(e => ['break', 'blocked'].includes(e.exception_type) && e.date && !e.is_recurring).forEach(e => {
      if (!exceptionsMap[e.date]) exceptionsMap[e.date] = [];
      exceptionsMap[e.date].push(e);
    });
    setExceptions({ _all: allExceptions.filter(e => ['break', 'blocked'].includes(e.exception_type)), ...exceptionsMap });

    if (bios.length > 0) setTherapistBio(bios[0]);
    const cfg = configs[0] || null;
    setConfig(cfg);

    const now = new Date();
    const today = format(startOfDay(now), 'yyyy-MM-dd');
    const [endH, endM] = (configs[0]?.end_time || '17:00').split(':').map(Number);
    const todayEndTime = new Date(); todayEndTime.setHours(endH, endM, 0, 0);
    const isTodayActive = now < todayEndTime;
    const dates = rawDates.map(d => d.date).filter(d => d > today || (d === today && isTodayActive)).sort();
    setMassageDates(dates);

    const activeBookings = bookings.filter(b => ['booked', 'confirmed'].includes(b.status));
    setAllBookings(activeBookings);
    setMyBookings(mine.filter(b => ['booked', 'confirmed'].includes(b.status)));

    if (dates.length > 0 && cfg) {
      const nextDate = dates[0];
      const dayBookings = activeBookings.filter(b => b.date === nextDate);
      const dayOfWeek = new Date(nextDate + 'T12:00:00').getDay();
      const dayExceptions = allExceptions.filter(e =>
        ['break', 'blocked'].includes(e.exception_type) &&
        (e.date === nextDate || (e.is_recurring && e.recurring_days?.includes(dayOfWeek)))
      );
      setNextDateSlots(generateSlots(cfg, dayBookings, nextDate, dayExceptions));
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const handleSlotClick = (slot, dateStr) => {
    if (slot.booking || slot.isBreak) return;
    if (myBookingForDate(dateStr)) return;
    setSelectedSlot(slot);
    setSelectedSlotDate(new Date(dateStr + 'T12:00:00'));
    setShowConfirmation(true);
  };

  const handleConfirmBooking = async (notes) => {
    setIsBooking(true);
    const dateStr = format(selectedSlotDate, 'yyyy-MM-dd');

    const latestBookings = await base44.entities.Booking.filter({ date: dateStr, start_time: selectedSlot.start_time });
    const slotTaken = latestBookings.some(b =>
      ['booked', 'confirmed'].includes(b.status) && b.user_email !== user.email
    );

    if (slotTaken) {
      toast({ title: "Slot no longer available", description: "Someone else just booked this slot. Please choose a different time.", variant: "destructive" });
      setIsBooking(false);
      setShowConfirmation(false);
      setSelectedSlot(null);
      await loadData();
      return;
    }

    await base44.entities.Booking.create({
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
    });

    toast({ title: "You're all set!", description: `Your massage is booked for ${format(selectedSlotDate, 'MMMM d')} at ${to12(selectedSlot.start_time)}` });
    setIsBooking(false);
    setShowConfirmation(false);
    setSelectedSlot(null);
    await loadData();
  };

  const toggleDateExpand = (dateStr) => {
    setExpandedDates(prev => {
      const nowExpanded = !prev[dateStr];
      if (nowExpanded && !dateSlots[dateStr]) {
        const allExceptionsArr = exceptions._all || [];
        const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
        const breaksForDate = allExceptionsArr.filter(e =>
          e.date === dateStr || (e.is_recurring && e.recurring_days?.includes(dayOfWeek))
        );
        const bookingsForDate = allBookings.filter(b => b.date === dateStr);
        const slots = generateSlots(config, bookingsForDate, dateStr, breaksForDate);
        setDateSlots(ds => ({ ...ds, [dateStr]: slots }));
      }
      return { ...prev, [dateStr]: nowExpanded };
    });
  };

  if (user?.role === 'therapist') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome, {user?.full_name?.split(' ')[0]}</h1>
          <p className="text-gray-500 mb-6">View today's schedule and manage sessions</p>
          <Button onClick={() => navigate(createPageUrl('TherapistView'))} className="bg-indigo-600 hover:bg-indigo-700">
            View Today's Schedule
          </Button>
        </div>
      </div>
    );
  }

  const myBookingForDate = (dateStr) => myBookings.find(b => b.date === dateStr);
  const nextDate = massageDates[0];
  const nextDateObj = nextDate ? parseISO(nextDate) : null;
  const today = format(new Date(), 'yyyy-MM-dd');
  const isToday = nextDate === today;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Therapist Bio */}
        {therapistBio && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center">
            {therapistBio.photo_url ? (
              <img src={therapistBio.photo_url} alt={therapistBio.name} className="w-28 h-28 rounded-full object-cover mb-4 border-4 border-indigo-100" />
            ) : (
              <div className="w-28 h-28 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                <User className="w-14 h-14 text-indigo-400" />
              </div>
            )}
            {therapistBio.name && (
              <h3 className="text-lg font-semibold text-gray-900">{therapistBio.name}</h3>
            )}
            {therapistBio.title && (
              <p className="text-sm text-indigo-600 font-medium mt-1">{therapistBio.title}</p>
            )}
            {therapistBio.bio && (
              <p className="text-sm text-gray-600 mt-3 leading-relaxed">{therapistBio.bio}</p>
            )}
          </div>
        )}

        {/* Right: Next date slot schedule + date list */}
        <div className={`${therapistBio ? 'lg:col-span-2' : 'lg:col-span-3'} flex flex-col gap-6`}>
          {/* Next massage schedule */}
          {nextDate && nextDateObj && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Next Session</span>
                {!myBookingForDate(nextDate) && (
                  <Button size="sm" onClick={() => navigate(createPageUrl('Book') + `?date=${nextDate}`)} className="bg-indigo-600 hover:bg-indigo-700">
                    Book a Slot
                  </Button>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {format(nextDateObj, 'EEEE, MMMM d, yyyy')}
                {isToday && <Badge className="ml-2 bg-green-100 text-green-700">Today</Badge>}
              </h2>

              {nextDateSlots.length === 0 ? (
                <p className="text-gray-500 text-sm mt-4">No slots available.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
                  {nextDateSlots.map((slot) => {
                    const isMySlot = myBookingForDate(nextDate)?.start_time === slot.start_time;
                    const isConfirmed = slot.booking?.status === 'confirmed';
                    const isOpenAndBookable = !slot.booking && !slot.isBreak && !myBookingForDate(nextDate);
                    return (
                      <button
                        key={slot.start_time}
                        onClick={() => isOpenAndBookable && handleSlotClick(slot, nextDate)}
                        className={`rounded-lg px-3 py-2.5 text-sm flex flex-col gap-0.5 border transition-all ${
                          isMySlot
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : slot.isBreak
                            ? 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                            : slot.booking
                            ? 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed'
                            : isOpenAndBookable
                            ? 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer'
                            : 'bg-white text-gray-400 border-gray-100 cursor-not-allowed'
                        }`}
                      >
                        <span className="font-semibold">{to12(slot.start_time)}</span>
                        <span className="text-xs opacity-75">
                          {isMySlot ? (isConfirmed ? '✓ Confirmed' : '✓ Booked') : slot.isBreak ? 'Break' : slot.booking ? 'Taken' : 'Open'}
                        </span>
                        {isMySlot && (
                          <span className="mt-1">
                            <CalendarIndicator booking={myBookingForDate(nextDate)} size="sm" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* All upcoming dates */}
          {massageDates.length > 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">All Upcoming Dates</h3>
              <div className="flex flex-col gap-2">
                {massageDates.slice(1).map((dateStr) => {
                  const myB = myBookingForDate(dateStr);
                  const isExpanded = expandedDates[dateStr];
                  const slots = dateSlots[dateStr] || [];
                  return (
                    <div key={dateStr} className="border border-gray-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleDateExpand(dateStr)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-indigo-400" />
                          <span className="font-medium text-gray-800">{format(parseISO(dateStr), 'EEEE, MMMM d')}</span>
                          {myB && <Badge className="bg-indigo-100 text-indigo-700 text-xs">My slot: {to12(myB.start_time)}</Badge>}
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4">
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {slots.map((slot) => {
                              const isMySlot = myB?.start_time === slot.start_time;
                              const isOpenAndBookable = !slot.booking && !slot.isBreak && !myB;
                              return (
                                <button
                                  key={slot.start_time}
                                  onClick={() => isOpenAndBookable && handleSlotClick(slot, dateStr)}
                                  className={`rounded-lg px-3 py-2 text-xs flex flex-col gap-0.5 border transition-all ${
                                    isMySlot
                                      ? 'bg-indigo-600 text-white border-indigo-600'
                                      : slot.isBreak
                                      ? 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                                      : slot.booking
                                      ? 'bg-gray-100 text-gray-400 border-gray-100 cursor-not-allowed'
                                      : isOpenAndBookable
                                      ? 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer'
                                      : 'bg-white text-gray-400 border-gray-100 cursor-not-allowed'
                                  }`}
                                >
                                  <span className="font-semibold">{to12(slot.start_time)}</span>
                                  <span className="opacity-75">
                                    {isMySlot ? '✓ Mine' : slot.isBreak ? 'Break' : slot.booking ? 'Taken' : 'Open'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {massageDates.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No upcoming sessions</h3>
              <p className="text-gray-500">Check back soon for new massage dates.</p>
            </div>
          )}
        </div>
      </div>

      {showConfirmation && selectedSlot && (
        <BookingConfirmation
          slot={selectedSlot}
          date={selectedSlotDate}
          onConfirm={handleConfirmBooking}
          onCancel={() => { setShowConfirmation(false); setSelectedSlot(null); }}
          isLoading={isBooking}
        />
      )}
    </div>
  );
}