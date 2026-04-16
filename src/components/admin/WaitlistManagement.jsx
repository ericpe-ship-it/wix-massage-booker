import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Users, Trash2 } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const statusColors = {
  waiting: 'bg-blue-100 text-blue-700',
  offered: 'bg-green-100 text-green-700',
  accepted: 'bg-gray-100 text-gray-600',
  declined: 'bg-gray-100 text-gray-400',
  expired: 'bg-gray-100 text-gray-400',
};

export default function WaitlistManagement() {
  const { toast } = useToast();
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const entries = await base44.entities.Waitlist.list('-date', 200);
    setWaitlist(entries.filter(e => e.date >= today || ['waiting', 'offered'].includes(e.status)));
    setLoading(false);
  };

  const removeEntry = async (id) => {
    await base44.entities.Waitlist.delete(id);
    toast({ title: "Removed from waitlist" });
    loadData();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (waitlist.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Users className="w-10 h-10 mx-auto mb-3" />
        <p>No waitlist entries</p>
      </div>
    );
  }

  // Group by date
  const byDate = {};
  waitlist.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  return (
    <div className="space-y-6">
      {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => (
        <div key={date}>
          <h3 className="font-semibold text-gray-800 mb-3">
            {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
            <span className="ml-2 text-sm font-normal text-gray-500">({entries.length} waiting)</span>
          </h3>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {entries.sort((a, b) => (a.position || 99) - (b.position || 99)).map((entry, i) => (
              <div key={entry.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-4">#{entry.position || i + 1}</span>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{entry.user_name || entry.user_email}</p>
                    {entry.preferred_time_start && (
                      <p className="text-xs text-gray-500">Pref: {entry.preferred_time_start}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs ${statusColors[entry.status]}`}>{entry.status}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeEntry(entry.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}