import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const PRESETS = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last 3 Months', value: '3m' },
  { label: 'Last 6 Months', value: '6m' },
  { label: 'This Year', value: 'this_year' },
  { label: 'Custom Range', value: 'custom' },
];

function getDateRange(preset) {
  const today = format(new Date(), 'yyyy-MM-dd');
  if (preset === 'all') return { startDate: null, endDate: null };
  if (preset === '30d') return { startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'), endDate: today };
  if (preset === 'this_month') return { startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'), endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd') };
  if (preset === '3m') return { startDate: format(subMonths(new Date(), 3), 'yyyy-MM-dd'), endDate: today };
  if (preset === '6m') return { startDate: format(subMonths(new Date(), 6), 'yyyy-MM-dd'), endDate: today };
  if (preset === 'this_year') return { startDate: format(startOfYear(new Date()), 'yyyy-MM-dd'), endDate: today };
  return null;
}

export default function UserBookingStats() {
  const [preset, setPreset] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (preset !== 'custom') fetchStats();
  }, [preset]);

  const fetchStats = async () => {
    let range;
    if (preset === 'custom') {
      if (!customStart || !customEnd) return;
      range = { startDate: customStart, endDate: customEnd };
    } else {
      range = getDateRange(preset);
    }
    setLoading(true);
    const res = await base44.functions.invoke('getUserBookingStats', range || {});
    setStats(res.data.stats || []);
    setLoading(false);
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) fetchStats();
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              User Booking Reports
            </CardTitle>
            <CardDescription>Booking counts per employee for the selected period</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {preset === 'custom' && (
              <>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-36" />
                <span className="text-gray-400 text-sm">to</span>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-36" />
                <button
                  onClick={handleCustomApply}
                  disabled={!customStart || !customEnd}
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  Apply
                </button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : stats.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No booking data for this period</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">#</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500">Name</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 hidden sm:table-cell">Email</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">Total</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500 hidden md:table-cell">Completed</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500 hidden md:table-cell">Cancelled</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500 hidden md:table-cell">No Show</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.map((row, i) => (
                  <tr key={row.user_email} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4 text-gray-400">{i + 1}</td>
                    <td className="py-3 pr-4 font-medium text-gray-900">{row.user_name}</td>
                    <td className="py-3 pr-4 text-gray-500 hidden sm:table-cell">{row.user_email}</td>
                    <td className="py-3 px-2 text-center">
                      <Badge className="bg-indigo-100 text-indigo-700">{row.total}</Badge>
                    </td>
                    <td className="py-3 px-2 text-center hidden md:table-cell">
                      <span className="text-green-600 font-medium">{row.completed}</span>
                    </td>
                    <td className="py-3 px-2 text-center hidden md:table-cell">
                      <span className="text-gray-500">{row.cancelled + row.late_cancelled}</span>
                    </td>
                    <td className="py-3 px-2 text-center hidden md:table-cell">
                      <span className="text-red-500">{row.no_show}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}