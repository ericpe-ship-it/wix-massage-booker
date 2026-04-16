import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { format, addDays, startOfWeek } from "date-fns";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Calendar, Clock, Plus, Trash2, Coffee } from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AdminSchedule() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [config, setConfig] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [massageDates, setMassageDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDateInput, setNewDateInput] = useState('');

  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [exceptionDialog, setExceptionDialog] = useState({ open: false, date: null, type: null });
  const [newException, setNewException] = useState({ exception_type: 'break', start_time: '12:00', end_time: '13:00', reason: '' });

  const [recurringBreakDialog, setRecurringBreakDialog] = useState(false);
  const [newRecurring, setNewRecurring] = useState({ start_time: '13:00', end_time: '14:00', reason: 'Lunch Break', block_on_calendar: true });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      if (me.role !== 'admin' && me.role !== 'super_admin') {
        navigate(createPageUrl('Home'));
        return;
      }
      const [configs, allExceptions, dates] = await Promise.all([
        base44.entities.ScheduleConfig.list(),
        base44.entities.ScheduleException.list(),
        base44.entities.MassageDate.list('date', 200)
      ]);
      if (configs.length > 0) setConfig(configs[0]);
      setExceptions(allExceptions);
      setMassageDates(dates.sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error) {
      console.error('Error loading schedule data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMassageDate = async () => {
    if (!newDateInput) return;
    const exists = massageDates.find(d => d.date === newDateInput);
    if (exists) {
      toast({ title: "Date already exists", variant: "destructive" });
      return;
    }
    await base44.entities.MassageDate.create({ date: newDateInput, is_active: true });
    toast({ title: "Date added" });
    setNewDateInput('');
    loadData();
  };

  const toggleMassageDate = async (massageDate) => {
    await base44.entities.MassageDate.update(massageDate.id, { is_active: !massageDate.is_active });
    loadData();
  };

  const removeMassageDate = async (id) => {
    await base44.entities.MassageDate.delete(id);
    toast({ title: "Date removed" });
    loadData();
  };

  const updateConfig = async (updates) => {
    setSaving(true);
    await base44.entities.ScheduleConfig.update(config.id, updates);
    setConfig({ ...config, ...updates });
    toast({ title: "Settings saved" });
    setSaving(false);
  };

  const addException = async () => {
    await base44.entities.ScheduleException.create({
      date: format(exceptionDialog.date, 'yyyy-MM-dd'),
      exception_type: newException.exception_type,
      start_time: newException.start_time,
      end_time: newException.end_time,
      reason: newException.reason,
      is_recurring: false
    });
    toast({ title: "Exception added" });
    setExceptionDialog({ open: false, date: null, type: null });
    setNewException({ exception_type: 'break', start_time: '12:00', end_time: '13:00', reason: '' });
    loadData();
  };

  const removeException = async (exceptionId) => {
    await base44.entities.ScheduleException.delete(exceptionId);
    toast({ title: "Exception removed" });
    loadData();
  };

  const addRecurringBreak = async () => {
    const daysWithMassages = new Set();
    massageDates.forEach(md => {
      const dayOfWeek = new Date(md.date + 'T12:00:00').getDay();
      daysWithMassages.add(dayOfWeek);
    });
    const recurringDays = newRecurring.block_on_calendar ? Array.from(daysWithMassages).sort() : [];
    await base44.entities.ScheduleException.create({
      exception_type: 'break',
      start_time: newRecurring.start_time,
      end_time: newRecurring.end_time,
      reason: newRecurring.reason,
      is_recurring: true,
      recurring_days: recurringDays
    });
    toast({ title: "Recurring break added" });
    setRecurringBreakDialog(false);
    setNewRecurring({ start_time: '13:00', end_time: '14:00', reason: 'Lunch Break', block_on_calendar: true });
    loadData();
  };

  const applyBreakToAllDates = async () => {
    if (exceptions.filter(e => e.is_recurring).length === 0) {
      toast({ title: "No recurring breaks to apply", variant: "destructive" });
      return;
    }
    setSaving(true);
    const recurringBreaks = exceptions.filter(e => e.is_recurring);
    try {
      for (const breakRule of recurringBreaks) {
        for (const date of massageDates) {
          const dayOfWeek = new Date(date.date + 'T12:00:00').getDay();
          if (breakRule.recurring_days?.includes(dayOfWeek)) {
            const exists = exceptions.find(e =>
              e.date === date.date && e.exception_type === 'break' &&
              e.start_time === breakRule.start_time && e.end_time === breakRule.end_time
            );
            if (!exists) {
              await base44.entities.ScheduleException.create({
                exception_type: 'break',
                date: date.date,
                start_time: breakRule.start_time,
                end_time: breakRule.end_time,
                reason: breakRule.reason,
                is_recurring: false
              });
            }
          }
        }
      }
      toast({ title: "Breaks applied to all dates" });
      loadData();
    } catch (error) {
      toast({ title: "Error applying breaks", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => navigate(createPageUrl('AdminDashboard'))} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Button>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">Schedule Management</h1>

      {/* Working Hours */}
      {config && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Working Hours</CardTitle>
            <CardDescription>Set default daily hours</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Time</Label>
              <Input type="time" className="mt-1" value={config.start_time || ''} onChange={(e) => updateConfig({ start_time: e.target.value })} />
            </div>
            <div>
              <Label>End Time</Label>
              <Input type="time" className="mt-1" value={config.end_time || ''} onChange={(e) => updateConfig({ end_time: e.target.value })} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session Settings */}
      {config && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Session Settings</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <Label>Slot Duration (minutes)</Label>
              <Select value={String(config.slot_duration_minutes || 13)} onValueChange={(v) => updateConfig({ slot_duration_minutes: parseInt(v) })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="13">13 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="20">20 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Buffer Between Sessions (minutes)</Label>
              <Select value={String(config.buffer_minutes || 0)} onValueChange={(v) => updateConfig({ buffer_minutes: parseInt(v) })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No buffer</SelectItem>
                  <SelectItem value="2">2 minutes</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Massage Dates */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Massage Dates</CardTitle>
          <CardDescription>Add the specific dates when massages will be available for booking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input type="date" value={newDateInput} onChange={(e) => setNewDateInput(e.target.value)} className="flex-1" />
            <Button onClick={addMassageDate} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1" /> Add Date
            </Button>
          </div>

          {massageDates.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No massage dates added yet.</p>
          ) : (() => {
            const today = new Date().toISOString().split('T')[0];
            const upcoming = massageDates.filter(md => md.date >= today);
            const past = massageDates.filter(md => md.date < today);
            const renderRow = (md) => (
              <div key={md.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <Switch checked={md.is_active} onCheckedChange={() => toggleMassageDate(md)} />
                  <span className={`text-sm font-medium ${md.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                    {format(new Date(md.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeMassageDate(md.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
            return (
              <div>
                {upcoming.length > 0 && <div>{upcoming.map(renderRow)}</div>}
                {past.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium mt-4 mb-2">Past Dates</p>
                    {[...past].reverse().map(renderRow)}
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Recurring Breaks */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recurring Breaks</CardTitle>
              <CardDescription>Daily breaks like lunch that apply every week</CardDescription>
            </div>
            <Button onClick={() => setRecurringBreakDialog(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1" /> Add Break
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {exceptions.filter(e => e.is_recurring).length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No recurring breaks configured.</p>
          ) : (
            <div>
              {exceptions.filter(e => e.is_recurring).map(ex => (
                <div key={ex.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="font-medium text-gray-900 text-sm">{ex.reason || 'Break'}</span>
                    <span className="text-xs text-gray-500 ml-2">{ex.start_time} – {ex.end_time}</span>
                    <span className="text-xs text-gray-400 ml-2">· {ex.recurring_days?.length ? 'Blocked on calendar' : 'Not blocked'}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeException(ex.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="mt-4 w-full" onClick={applyBreakToAllDates} disabled={saving}>
                {saving ? 'Applying...' : 'Apply to All Existing Dates'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Recurring Break Dialog */}
      <Dialog open={recurringBreakDialog} onOpenChange={setRecurringBreakDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Recurring Break</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Break Name / Reason</Label>
              <Input className="mt-1" value={newRecurring.reason} onChange={(e) => setNewRecurring({ ...newRecurring, reason: e.target.value })} placeholder="e.g., Lunch Break" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Time</Label>
                <Input type="time" className="mt-1" value={newRecurring.start_time} onChange={(e) => setNewRecurring({ ...newRecurring, start_time: e.target.value })} />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" className="mt-1" value={newRecurring.end_time} onChange={(e) => setNewRecurring({ ...newRecurring, end_time: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={newRecurring.block_on_calendar} onCheckedChange={(v) => setNewRecurring({ ...newRecurring, block_on_calendar: v })} />
              <Label>Block on calendar during massage days</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurringBreakDialog(false)}>Cancel</Button>
            <Button onClick={addRecurringBreak} className="bg-indigo-600 hover:bg-indigo-700">Add Break</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}