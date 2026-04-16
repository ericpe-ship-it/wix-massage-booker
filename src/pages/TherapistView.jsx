import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, parseISO, isToday, addMinutes, parse } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { ChevronLeft, ChevronRight, Clock, Check, X, RefreshCw, NotebookPen, Save, UserPlus, UserX, Search, Mail } from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import MassageTimer from '../components/therapist/MassageTimer';
import CalendarIndicator from '../components/therapist/CalendarIndicator';
import ConfirmationStatusIndicator from '../components/therapist/ConfirmationStatusIndicator';
import { Input } from '@/components/ui/input';

const statusConfig = {
  booked: { label: 'Booked', color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  completed: { label: 'Done', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  no_show: { label: 'No Show', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-400', dot: 'bg-gray-300' }
};

const to12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export default function TherapistView() {
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState(null);
  const [massageDates, setMassageDates] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [slotDuration, setSlotDuration] = useState(13);

  const [noteDialog, setNoteDialog] = useState({ open: false, booking: null, note: '', saving: false });
  const [therapistNotes, setTherapistNotes] = useState({});
  const [exceptions, setExceptions] = useState([]);

  const [slotEditDialog, setSlotEditDialog] = useState({ open: false, slot: null });
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [slotSaving, setSlotSaving] = useState(false);
  const [addUserDialog, setAddUserDialog] = useState({ open: false });
  const [newUserEmail, setNewUserEmail] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { if (selectedDate) loadBookings(); }, [selectedDate]);

  const loadInitialData = async () => {
    try {
      const [configs, dates] = await Promise.all([
        base44.entities.ScheduleConfig.list(),
        base44.entities.MassageDate.filter({ is_active: true }, 'date')
      ]);

      if (configs.length > 0) {
        setConfig(configs[0]);
        setSlotDuration(configs[0].slot_duration_minutes || 13);
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      const futureDates = dates.filter(d => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
      setMassageDates(futureDates);

      if (futureDates.length > 0) {
        setSelectedDate(parseISO(futureDates[0].date));
      } else {
        setSelectedDate(new Date());
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      setSelectedDate(new Date());
    }
  };

  const loadBookings = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const result = await base44.functions.invoke('getTherapistSchedule', { date: dateStr });
      const { bookings: dayBookings = [], exceptions: dayExceptions = [], users = [] } = result.data || {};
      const activeBookings = dayBookings.filter(b => !['cancelled', 'late_cancelled'].includes(b.status));
      setBookings(activeBookings);
      setAllUsers(users);
      setExceptions(dayExceptions.filter(e => ['break', 'blocked'].includes(e.exception_type)));

      if (activeBookings.length > 0) {
        const emails = [...new Set(activeBookings.map(b => b.user_email))];
        const notesMap = {};
        for (const email of emails) {
          const notes = await base44.entities.TherapistNote.filter({ user_email: email });
          if (notes.length > 0) notesMap[email] = notes[0];
        }
        setTherapistNotes(notesMap);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (booking, newStatus) => {
    setUpdating(booking.id);

    if (newStatus === 'no_show') {
      const users = await base44.entities.User.filter({ email: booking.user_email });
      if (users.length > 0) {
        await base44.entities.User.update(users[0].id, { no_show_count: (users[0].no_show_count || 0) + 1 });
      }
    }
    if (newStatus === 'completed') {
      const users = await base44.entities.User.filter({ email: booking.user_email });
      if (users.length > 0) {
        await base44.entities.User.update(users[0].id, { total_bookings: (users[0].total_bookings || 0) + 1 });
      }
    }

    await base44.entities.Booking.update(booking.id, { status: newStatus });
    toast({ title: "Status Updated", description: `Marked as ${statusConfig[newStatus]?.label}` });
    setUpdating(null);
    loadBookings();
  };

  const navigateDate = (direction) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const currentDateStr = format(selectedDate, 'yyyy-MM-dd');
    const currentIdx = massageDates.findIndex(d => d.date === currentDateStr);

    if (direction === 'next' && currentIdx < massageDates.length - 1) {
      setSelectedDate(parseISO(massageDates[currentIdx + 1].date));
    } else if (direction === 'prev' && currentIdx > 0) {
      const prevDate = massageDates[currentIdx - 1];
      if (prevDate.date >= today) {
        setSelectedDate(parseISO(prevDate.date));
      }
    }
  };

  const canGoPrev = () => {
    if (!selectedDate || massageDates.length === 0) return false;
    const today = format(new Date(), 'yyyy-MM-dd');
    const currentDateStr = format(selectedDate, 'yyyy-MM-dd');
    const currentIdx = massageDates.findIndex(d => d.date === currentDateStr);
    if (currentIdx <= 0) return false;
    return massageDates[currentIdx - 1].date >= today;
  };

  const canGoNext = () => {
    if (!selectedDate || massageDates.length === 0) return false;
    const currentDateStr = format(selectedDate, 'yyyy-MM-dd');
    const currentIdx = massageDates.findIndex(d => d.date === currentDateStr);
    return currentIdx < massageDates.length - 1;
  };

  const openNoteDialog = (booking) => {
    const existing = therapistNotes[booking.user_email];
    setNoteDialog({ open: true, booking, note: existing?.note || '', saving: false });
  };

  const saveNote = async () => {
    setNoteDialog(prev => ({ ...prev, saving: true }));
    const { booking, note } = noteDialog;
    const existing = therapistNotes[booking.user_email];

    if (existing) {
      await base44.entities.TherapistNote.update(existing.id, { note, updated_by: 'therapist' });
    } else {
      await base44.entities.TherapistNote.create({ user_email: booking.user_email, user_name: booking.user_name, note, updated_by: 'therapist' });
    }

    toast({ title: "Note Saved" });
    setNoteDialog({ open: false, booking: null, note: '', saving: false });
    loadBookings();
  };

  const generateAllSlots = () => {
    if (!config || !selectedDate) return [];
    const slots = [];
    const start = parse(config.start_time || '08:00', 'HH:mm', new Date());
    const end = parse(config.end_time || '17:00', 'HH:mm', new Date());
    const duration = slotDuration;
    const buffer = config.buffer_minutes || 0;

    const timeToMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    let current = start;
    while (addMinutes(current, duration) <= end) {
      const timeStr = format(current, 'HH:mm');
      const endStr = format(addMinutes(current, duration), 'HH:mm');
      const booking = bookings.find(b => b.start_time === timeStr);

      const slotStartMin = timeToMinutes(timeStr);
      const slotEndMin = timeToMinutes(endStr);
      const isBreak = exceptions.some(e => {
        const breakStart = timeToMinutes(e.start_time);
        const breakEnd = timeToMinutes(e.end_time);
        return slotStartMin < breakEnd && slotEndMin > breakStart;
      });

      slots.push({ start: timeStr, end: endStr, booking: booking || null, isBreak });
      current = addMinutes(current, duration + buffer);
    }
    return slots;
  };

  const assignUserToSlot = async (user) => {
    setSlotSaving(true);
    const { slot } = slotEditDialog;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    if (slot.booking) {
      await base44.entities.Booking.update(slot.booking.id, { status: 'cancelled', cancelled_at: new Date().toISOString() });
    }

    await base44.entities.Booking.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      date: dateStr, start_time: slot.start, end_time: slot.end,
      status: 'booked', booked_by_admin: true
    });

    toast({ title: "Slot Assigned", description: `${user.full_name} added to ${to12(slot.start)}` });
    setSlotSaving(false);
    setSlotEditDialog({ open: false, slot: null });
    loadBookings();
  };

  const removeFromSlot = async () => {
    setSlotSaving(true);
    const { slot } = slotEditDialog;
    await base44.entities.Booking.update(slot.booking.id, { status: 'cancelled', cancelled_at: new Date().toISOString() });
    toast({ title: "Slot Cleared" });
    setSlotSaving(false);
    setSlotEditDialog({ open: false, slot: null });
    loadBookings();
  };

  const addNewUser = async () => {
    if (!newUserEmail.trim()) return;
    setAddingUser(true);
    await base44.users.inviteUser(newUserEmail.trim(), 'user');
    const users = await base44.entities.User.list();
    setAllUsers(users);
    setAddUserDialog({ open: false });
    setNewUserEmail('');
    setAddingUser(false);
    toast({ title: "User invited" });
  };

  const allSlots = generateAllSlots();
  const filteredUsers = allUsers.filter(u =>
    !userSearch || u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => canGoPrev() && navigateDate('prev')} disabled={!canGoPrev()} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900">
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : '...'}
              {selectedDate && isToday(selectedDate) && <Badge className="ml-2 bg-green-100 text-green-700">Today</Badge>}
            </h1>
          </div>
          <button onClick={() => canGoNext() && navigateDate('next')} disabled={!canGoNext()} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{bookings.length} booked</span>
          <Button size="sm" variant="outline" onClick={loadBookings}><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Schedule */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : allSlots.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No schedule configured for this date</div>
        ) : (
          <div className="flex flex-col gap-2">
            {allSlots.map((slot, i) => {
              const booking = slot.booking;
              const note = booking ? therapistNotes[booking.user_email] : null;
              const status = booking ? statusConfig[booking.status] : null;

              if (slot.isBreak) {
                return (
                  <div key={i} className="bg-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 text-gray-400">
                    <span className="font-medium text-sm w-16">{to12(slot.start)}</span>
                    <span className="text-sm">— Break —</span>
                  </div>
                );
              }

              return (
                <div key={i} className={`bg-white rounded-xl border shadow-sm px-4 py-3 ${booking ? 'border-gray-200' : 'border-dashed border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-700 w-16 text-sm">{to12(slot.start)}</span>
                      {booking ? (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{booking.user_name}</span>
                            <CalendarIndicator booking={booking} size="sm" />
                            <ConfirmationStatusIndicator booking={booking} size="sm" />
                            {note && <NotebookPen className="w-3.5 h-3.5 text-indigo-400" />}
                          </div>
                          {note && <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{note.note}</p>}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Open</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {booking && (
                        <>
                          <Badge className={status?.color}>{status?.label}</Badge>
                          {!['completed', 'no_show'].includes(booking.status) && (
                            <>
                              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 h-7 px-2" onClick={() => updateBookingStatus(booking, 'completed')} disabled={updating === booking.id}>
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 h-7 px-2" onClick={() => updateBookingStatus(booking, 'no_show')} disabled={updating === booking.id}>
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-gray-400" onClick={() => openNoteDialog(booking)}>
                            <NotebookPen className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-gray-400" onClick={() => { setUserSearch(''); setSlotEditDialog({ open: true, slot }); }}>
                        {booking ? <UserX className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                      </Button>
                      {booking && <MassageTimer duration={slotDuration} startTime={slot.start} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Note Dialog */}
      <Dialog open={noteDialog.open} onOpenChange={(open) => !open && setNoteDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Notes — {noteDialog.booking?.user_name}</DialogTitle></DialogHeader>
          <Textarea
            value={noteDialog.note}
            onChange={(e) => setNoteDialog(prev => ({ ...prev, note: e.target.value }))}
            placeholder="Private therapist notes..."
            className="h-32 resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog({ open: false, booking: null, note: '', saving: false })}>Cancel</Button>
            <Button onClick={saveNote} disabled={noteDialog.saving} className="bg-indigo-600 hover:bg-indigo-700">
              {noteDialog.saving ? <LoadingSpinner size="sm" /> : <><Save className="w-4 h-4 mr-1" /> Save</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slot Edit Dialog */}
      <Dialog open={slotEditDialog.open} onOpenChange={(open) => setSlotEditDialog({ ...slotEditDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{slotEditDialog.slot?.booking ? 'Reassign Slot' : 'Assign Slot'} — {to12(slotEditDialog.slot?.start)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {slotEditDialog.slot?.booking && (
              <Button variant="outline" className="w-full text-red-600 border-red-200" onClick={removeFromSlot} disabled={slotSaving}>
                <UserX className="w-4 h-4 mr-2" /> Remove {slotEditDialog.slot.booking.user_name}
              </Button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
              {filteredUsers.map(u => (
                <button key={u.id} onClick={() => assignUserToSlot(u)} disabled={slotSaving} className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors">
                  <div className="font-medium text-gray-900 text-sm">{u.full_name}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={() => { setSlotEditDialog({ open: false, slot: null }); setAddUserDialog({ open: true }); }}>
              <UserPlus className="w-4 h-4 mr-2" /> Invite New User
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={addUserDialog.open} onOpenChange={(open) => setAddUserDialog({ open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite New User</DialogTitle></DialogHeader>
          <Input placeholder="Email address" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserDialog({ open: false })}>Cancel</Button>
            <Button onClick={addNewUser} disabled={addingUser} className="bg-indigo-600 hover:bg-indigo-700">
              {addingUser ? <LoadingSpinner size="sm" /> : 'Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}