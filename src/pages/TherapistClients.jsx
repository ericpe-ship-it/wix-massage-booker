import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Search, NotebookPen, Save, Flag, CheckCircle, XCircle, Star, ArrowLeft } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ClientDetailPanel from '../components/therapist/ClientDetailPanel';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Has Notes', value: 'has_notes' },
  { label: 'No-Show Flag', value: 'flagged_noshow' },
  { label: 'Late Cancels', value: 'flagged_latecancel' },
  { label: 'Active Bookers', value: 'active' },
];

export default function TherapistClients() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [therapistNotes, setTherapistNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [noteDialog, setNoteDialog] = useState({ open: false, user: null, note: '', saving: false });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allUsers, allBookings, allNotes] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.Booking.list('-date', 500),
        base44.entities.TherapistNote.list(),
      ]);
      setUsers(allUsers.filter(u => u.role !== 'therapist'));
      setBookings(allBookings);
      setTherapistNotes(allNotes);
    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const notesByEmail = useMemo(() => {
    const map = {};
    therapistNotes.forEach(n => { map[n.user_email] = n; });
    return map;
  }, [therapistNotes]);

  const bookingsByEmail = useMemo(() => {
    const map = {};
    bookings.forEach(b => {
      if (!map[b.user_email]) map[b.user_email] = [];
      map[b.user_email].push(b);
    });
    return map;
  }, [bookings]);

  const enrichedUsers = useMemo(() => {
    return users.map(u => {
      const userBookings = bookingsByEmail[u.email] || [];
      const completed = userBookings.filter(b => b.status === 'completed').length;
      const noShows = userBookings.filter(b => b.status === 'no_show').length;
      const lateCancels = userBookings.filter(b => b.status === 'late_cancelled').length;
      const upcoming = userBookings.filter(b => ['booked', 'confirmed'].includes(b.status)).length;
      const note = notesByEmail[u.email];
      const avgRating = (() => {
        const rated = userBookings.filter(b => b.feedback_rating);
        if (!rated.length) return null;
        return (rated.reduce((s, b) => s + b.feedback_rating, 0) / rated.length).toFixed(1);
      })();
      return { ...u, completed, noShows, lateCancels, upcoming, note, avgRating, allBookings: userBookings };
    });
  }, [users, bookingsByEmail, notesByEmail]);

  const filtered = useMemo(() => {
    let list = enrichedUsers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }
    switch (filter) {
      case 'has_notes': list = list.filter(u => u.note); break;
      case 'flagged_noshow': list = list.filter(u => u.noShows > 0); break;
      case 'flagged_latecancel': list = list.filter(u => u.lateCancels > 0); break;
      case 'active': list = list.filter(u => u.upcoming > 0 || u.completed > 0); break;
    }
    return list.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [enrichedUsers, search, filter]);

  const openNoteDialog = (user) => {
    const existing = notesByEmail[user.email];
    setNoteDialog({ open: true, user, note: existing?.note || '', saving: false });
  };

  const saveNote = async () => {
    setNoteDialog(prev => ({ ...prev, saving: true }));
    try {
      const { user, note } = noteDialog;
      const existing = notesByEmail[user.email];
      if (existing) {
        await base44.entities.TherapistNote.update(existing.id, { note, updated_by: 'therapist' });
      } else {
        await base44.entities.TherapistNote.create({ user_email: user.email, user_name: user.full_name, note, updated_by: 'therapist' });
      }
      toast({ title: 'Note saved' });
      setNoteDialog({ open: false, user: null, note: '', saving: false });
      await loadData();
    } catch (error) {
      toast({ title: 'Error saving note', variant: 'destructive' });
      setNoteDialog(prev => ({ ...prev, saving: false }));
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('TherapistView')} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Schedule
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Client Directory</h1>
        </div>
        <span className="text-sm text-gray-500">{filtered.length} of {users.length} clients</span>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${filter === f.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client List */}
        <div className="lg:col-span-2 flex flex-col gap-2">
          {filtered.length === 0 && <p className="text-center text-gray-400 py-8">No clients found</p>}
          {filtered.map(user => (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className={`w-full text-left p-4 rounded-xl border bg-white hover:border-indigo-300 hover:shadow-sm transition-all ${selectedUser?.id === user.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-600">
                    {getInitials(user.full_name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{user.full_name}</span>
                      {user.note && <NotebookPen className="w-3 h-3 text-indigo-400" />}
                      {user.noShows > 0 && <Flag className="w-3 h-3 text-red-400" />}
                    </div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-700">{user.completed + user.upcoming} sessions</div>
                  <div className="flex gap-1 flex-wrap justify-end mt-1">
                    {user.upcoming > 0 && <Badge className="bg-indigo-100 text-indigo-700 text-xs">{user.upcoming} upcoming</Badge>}
                    {user.noShows > 0 && <Badge className="bg-red-100 text-red-700 text-xs">{user.noShows} no-show{user.noShows > 1 ? 's' : ''}</Badge>}
                    {user.avgRating && <Badge className="bg-yellow-100 text-yellow-700 text-xs">★ {user.avgRating}</Badge>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Detail Panel */}
        {selectedUser && (
          <div className="lg:col-span-1">
            <ClientDetailPanel
              user={selectedUser}
              onClose={() => setSelectedUser(null)}
              onEditNote={() => openNoteDialog(selectedUser)}
            />
          </div>
        )}
      </div>

      {/* Note Dialog */}
      <Dialog open={noteDialog.open} onOpenChange={(open) => !open && setNoteDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Notes — {noteDialog.user?.full_name}</DialogTitle></DialogHeader>
          <Textarea
            value={noteDialog.note}
            onChange={(e) => setNoteDialog(prev => ({ ...prev, note: e.target.value }))}
            placeholder="Private therapist notes about this client..."
            className="h-32 resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog({ open: false, user: null, note: '', saving: false })}>Cancel</Button>
            <Button onClick={saveNote} disabled={noteDialog.saving} className="bg-indigo-600 hover:bg-indigo-700">
              {noteDialog.saving ? <LoadingSpinner size="sm" /> : <><Save className="w-4 h-4 mr-1" /> Save Note</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}