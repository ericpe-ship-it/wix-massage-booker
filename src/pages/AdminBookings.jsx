import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { format, parseISO, startOfWeek, endOfWeek, addDays } from "date-fns";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Search, Filter, Calendar, Clock, User, MoreVertical, X, RefreshCw, Plus, Download, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import CalendarIndicator from "@/components/therapist/CalendarIndicator";
import ConfirmationStatusIndicator from "@/components/therapist/ConfirmationStatusIndicator";
import WaitlistManagement from "@/components/admin/WaitlistManagement";
import AdminCalendarView from "@/components/admin/AdminCalendarView";

const statusConfig = {
  booked: { label: 'Booked', color: 'bg-indigo-100 text-indigo-700' },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-600' },
  no_show: { label: 'No Show', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-400' },
  late_cancelled: { label: 'Late Cancel', color: 'bg-orange-100 text-orange-700' }
};

export default function AdminBookings() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [massageDates, setMassageDates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [sortBy, setSortBy] = useState('date_asc');

  const [cancelDialog, setCancelDialog] = useState({ open: false, booking: null });
  const [createDialog, setCreateDialog] = useState({ open: false });
  const [newBooking, setNewBooking] = useState({ user_email: '', date: '', start_time: '' });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [scheduleConfig, setScheduleConfig] = useState(null);
  const [inviteDialog, setInviteDialog] = useState({ open: false });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [statusDialog, setStatusDialog] = useState({ open: false, booking: null });
  const [selectedConfirmationStatus, setSelectedConfirmationStatus] = useState('booked');
  const [resendingEmail, setResendingEmail] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { filterBookings(); }, [bookings, searchQuery, statusFilter, dateRange, sortBy]);

  const loadData = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      if (me.role !== 'admin' && me.role !== 'super_admin') {
        navigate(createPageUrl('Home'));
        return;
      }
      const allBookings = await base44.entities.Booking.list('-date', 500);
      setBookings(allBookings);
      const allUsers = await base44.entities.User.list();
      setUsers(allUsers);
      const dates = await base44.entities.MassageDate.filter({ is_active: true }, 'date');
      setMassageDates(dates);
    } catch (error) {
      console.error('Error loading bookings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterBookings = () => {
    let filtered = [...bookings];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        b.user_name?.toLowerCase().includes(query) ||
        b.user_email?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }

    const today = new Date();
    if (dateRange === 'today') {
      const todayStr = format(today, 'yyyy-MM-dd');
      filtered = filtered.filter(b => b.date === todayStr);
    } else if (dateRange === 'week') {
      const weekStart = format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      filtered = filtered.filter(b => b.date >= weekStart && b.date <= weekEnd);
    } else if (dateRange === 'month') {
      const monthStart = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');
      const monthEnd = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd');
      filtered = filtered.filter(b => b.date >= monthStart && b.date <= monthEnd);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'date_asc') return (a.date + a.start_time).localeCompare(b.date + b.start_time);
      if (sortBy === 'date_desc') return (b.date + b.start_time).localeCompare(a.date + a.start_time);
      if (sortBy === 'user_asc') return (a.user_name || '').localeCompare(b.user_name || '');
      if (sortBy === 'user_desc') return (b.user_name || '').localeCompare(a.user_name || '');
      return 0;
    });

    setFilteredBookings(filtered);
  };

  const cancelBooking = async () => {
    await base44.entities.Booking.update(cancelDialog.booking.id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString()
    });
    toast({ title: "Booking cancelled" });
    setCancelDialog({ open: false, booking: null });
    loadData();
  };

  const loadSlotsForDate = async (dateStr) => {
    if (!dateStr) return;
    setAvailableSlots([]);
    const [configs, dayBookings, exceptions] = await Promise.all([
      base44.entities.ScheduleConfig.list(),
      base44.entities.Booking.filter({ date: dateStr }, 'start_time', 500),
      base44.entities.ScheduleException.list()
    ]);
    const cfg = configs[0];
    if (!cfg) return;
    setScheduleConfig(cfg);

    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const dayExceptions = exceptions.filter(e =>
      (e.date === dateStr || (e.is_recurring && e.recurring_days?.includes(new Date(dateStr + 'T12:00:00').getDay()))) &&
      ['break', 'blocked', 'closed'].includes(e.exception_type)
    );
    const isClosed = dayExceptions.some(e => e.exception_type === 'closed');
    if (isClosed) { setAvailableSlots([]); return; }

    const activeBookings = dayBookings.filter(b => !['cancelled', 'late_cancelled'].includes(b.status));
    const bookedTimes = new Set(activeBookings.map(b => b.start_time));

    const slots = [];
    const startMin = toMin(cfg.start_time);
    const endMin = toMin(cfg.end_time);
    const slotDur = parseInt(cfg.slot_duration_minutes, 10) || 15;
    const buffer = parseInt(cfg.buffer_minutes, 10) || 0;
    const step = slotDur + buffer;

    for (let min = startMin; min + slotDur <= endMin; min += step) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      const startStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const slotEndMin = min + slotDur;
      if (bookedTimes.has(startStr)) continue;
      const isBreak = dayExceptions.some(e =>
        ['break', 'blocked'].includes(e.exception_type) &&
        min < toMin(e.end_time) && slotEndMin > toMin(e.start_time)
      );
      if (!isBreak) slots.push(startStr);
    }
    setAvailableSlots(slots);
    setNewBooking(prev => ({ ...prev, start_time: slots.length > 0 ? slots[0] : '' }));
  };

  const to12 = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const createAdminBooking = async () => {
    const config = scheduleConfig || (await base44.entities.ScheduleConfig.list())[0];
    const [sh, sm] = newBooking.start_time.split(':').map(Number);
    const endDate = new Date(); endDate.setHours(sh, sm + (config?.slot_duration_minutes || 15), 0, 0);
    const endTime = format(endDate, 'HH:mm');
    const isGuest = newBooking.user_email === 'guest@admin';
    const selectedUser = isGuest ? null : users.find(u => u.email === newBooking.user_email);

    await base44.entities.Booking.create({
      user_id: selectedUser?.id,
      user_email: newBooking.user_email,
      user_name: isGuest ? 'Admin Guest User' : (selectedUser?.full_name || newBooking.user_email),
      date: newBooking.date,
      start_time: newBooking.start_time,
      end_time: endTime,
      status: 'booked',
      booked_by_admin: true,
      admin_override: true
    });

    toast({ title: "Booking created" });
    setCreateDialog({ open: false });
    setNewBooking({ user_email: '', date: '', start_time: '09:00' });
    loadData();
  };

  const inviteNewUser = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    await base44.users.inviteUser(inviteEmail.trim(), 'user');
    const allUsers = await base44.entities.User.list();
    setUsers(allUsers);
    setInviteDialog({ open: false });
    setInviteEmail('');
    setInviting(false);
    toast({ title: "User invited", description: `${inviteEmail} has been invited.` });
  };

  const syncCalendarStatus = async () => {
    setSyncing(true);
    try {
      await base44.functions.invoke('syncCalendarAcceptance', {});
      toast({ title: "Calendar sync complete" });
      loadData();
    } finally {
      setSyncing(false);
    }
  };

  const updateBookingStatus = async (booking, newStatus) => {
    await base44.entities.Booking.update(booking.id, { status: newStatus });
    toast({ title: "Status updated" });
    setStatusDialog({ open: false, booking: null });
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
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => navigate(createPageUrl('AdminDashboard'))} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Booking Management</h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={syncCalendarStatus} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Calendar
          </Button>
          <Button onClick={() => setInviteDialog({ open: true })} variant="outline">
            <User className="w-4 h-4 mr-2" /> Invite User
          </Button>
          <Button onClick={() => setCreateDialog({ open: true })} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> Create Booking
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="mb-6">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(statusConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_asc">Date ↑</SelectItem>
                <SelectItem value="date_desc">Date ↓</SelectItem>
                <SelectItem value="user_asc">Name A-Z</SelectItem>
                <SelectItem value="user_desc">Name Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredBookings.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No bookings found</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredBookings.map((booking) => {
                    const status = statusConfig[booking.status] || statusConfig.booked;
                    return (
                      <div key={booking.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium text-gray-900">{booking.user_name || booking.user_email}</div>
                            <div className="text-sm text-gray-500">
                              {booking.date} · {to12(booking.start_time)} – {to12(booking.end_time)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarIndicator booking={booking} size="sm" />
                          <ConfirmationStatusIndicator booking={booking} size="sm" />
                          <Badge className={status.color}>{status.label}</Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setStatusDialog({ open: true, booking, selectedStatus: booking.status })}>
                                Change Status
                              </DropdownMenuItem>
                              {['booked', 'confirmed'].includes(booking.status) && (
                                <DropdownMenuItem className="text-red-600" onClick={() => setCancelDialog({ open: true, booking })}>
                                  Cancel Booking
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <AdminCalendarView bookings={bookings} massageDates={massageDates} />
        </TabsContent>

        <TabsContent value="waitlist">
          <WaitlistManagement />
        </TabsContent>
      </Tabs>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ ...cancelDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>Cancel booking for {cancelDialog.booking?.user_name} on {cancelDialog.booking?.date}?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog({ open: false, booking: null })}>Keep</Button>
            <Button variant="destructive" onClick={cancelBooking}>Cancel Booking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Booking Dialog */}
      <Dialog open={createDialog.open} onOpenChange={(open) => setCreateDialog({ open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Booking</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">User</label>
              <Select value={newBooking.user_email} onValueChange={(v) => setNewBooking(prev => ({ ...prev, user_email: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select user..." /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.id} value={u.email}>{u.full_name} ({u.email})</SelectItem>)}
                  <SelectItem value="guest@admin">Guest / Walk-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Date</label>
              <Select value={newBooking.date} onValueChange={(v) => { setNewBooking(prev => ({ ...prev, date: v })); loadSlotsForDate(v); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select date..." /></SelectTrigger>
                <SelectContent>
                  {massageDates.map(d => <SelectItem key={d.id} value={d.date}>{format(parseISO(d.date), 'EEEE, MMMM d, yyyy')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {availableSlots.length > 0 && (
              <div>
                <label className="text-sm font-medium">Time Slot</label>
                <Select value={newBooking.start_time} onValueChange={(v) => setNewBooking(prev => ({ ...prev, start_time: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableSlots.map(s => <SelectItem key={s} value={s}>{to12(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog({ open: false })}>Cancel</Button>
            <Button onClick={createAdminBooking} disabled={!newBooking.user_email || !newBooking.date || !newBooking.start_time} className="bg-indigo-600 hover:bg-indigo-700">Create Booking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusDialog.open} onOpenChange={(open) => setStatusDialog({ ...statusDialog, open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Status — {statusDialog.booking?.user_name}</DialogTitle></DialogHeader>
          <Select value={selectedConfirmationStatus} onValueChange={setSelectedConfirmationStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog({ open: false, booking: null })}>Cancel</Button>
            <Button onClick={() => updateBookingStatus(statusDialog.booking, selectedConfirmationStatus)} className="bg-indigo-600 hover:bg-indigo-700">Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialog.open} onOpenChange={(open) => setInviteDialog({ open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
          <Input placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialog({ open: false })}>Cancel</Button>
            <Button onClick={inviteNewUser} disabled={inviting} className="bg-indigo-600 hover:bg-indigo-700">
              {inviting ? <LoadingSpinner size="sm" /> : 'Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}