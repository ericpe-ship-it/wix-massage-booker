import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Save, Calendar, Clock, Bell, MapPin, Users, ShieldAlert } from "lucide-react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function AdminSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      if (me.role !== 'super_admin') {
        navigate(createPageUrl('AdminDashboard'));
        return;
      }
      const configs = await base44.entities.ScheduleConfig.list();
      if (configs.length > 0) {
        setConfig(configs[0]);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (key, value) => {
    setConfig({ ...config, [key]: value });
  };

  const saveConfig = async () => {
    setSaving(true);
    await base44.entities.ScheduleConfig.update(config.id, config);
    toast({ title: "Settings saved successfully" });
    setSaving(false);
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
      <Button variant="ghost" onClick={() => navigate(createPageUrl('AdminDashboard'))} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Button>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <Button onClick={saveConfig} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
          {saving ? <LoadingSpinner size="sm" /> : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
        </Button>
      </div>

      {/* Booking Rules */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Booking Rules</CardTitle>
          <CardDescription>Configure booking limits and windows</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Booking Window (days in advance)</Label>
            <Select value={String(config?.booking_window_days || 14)} onValueChange={(v) => updateConfig('booking_window_days', parseInt(v))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">1 week</SelectItem>
                <SelectItem value="14">2 weeks</SelectItem>
                <SelectItem value="21">3 weeks</SelectItem>
                <SelectItem value="28">4 weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cancellation Cutoff (minutes before)</Label>
            <Select value={String(config?.cancellation_cutoff_minutes || 60)} onValueChange={(v) => updateConfig('cancellation_cutoff_minutes', parseInt(v))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="240">4 hours</SelectItem>
                <SelectItem value="1440">24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Per-Person Limits */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Per-Person Limits</CardTitle>
          <CardDescription>Control how often employees can book</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Max Bookings Per Day</Label>
            <Select value={String(config?.max_bookings_per_day || 1)} onValueChange={(v) => updateConfig('max_bookings_per_day', parseInt(v))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 booking</SelectItem>
                <SelectItem value="2">2 bookings</SelectItem>
                <SelectItem value="3">3 bookings</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Max Bookings Per Week</Label>
            <Select value={String(config?.max_bookings_per_week || 1)} onValueChange={(v) => updateConfig('max_bookings_per_week', parseInt(v))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 booking</SelectItem>
                <SelectItem value="2">2 bookings</SelectItem>
                <SelectItem value="3">3 bookings</SelectItem>
                <SelectItem value="5">5 bookings</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Session Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Session Settings</CardTitle>
          <CardDescription>Configure session duration and buffers</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Session Duration (minutes)</Label>
            <Select value={String(config?.slot_duration_minutes || 13)} onValueChange={(v) => updateConfig('slot_duration_minutes', parseInt(v))}>
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
            <Select value={String(config?.buffer_minutes || 0)} onValueChange={(v) => updateConfig('buffer_minutes', parseInt(v))}>
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

      {/* Cancellation Policy */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Cancellation Policy</CardTitle>
          <CardDescription>Rules shown to users during booking and on their booking page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Free Cancellation Window</Label>
            <Select value={String(config?.cancellation_cutoff_minutes || 60)} onValueChange={(v) => updateConfig('cancellation_cutoff_minutes', parseInt(v))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes before</SelectItem>
                <SelectItem value="60">1 hour before</SelectItem>
                <SelectItem value="120">2 hours before</SelectItem>
                <SelectItem value="240">4 hours before</SelectItem>
                <SelectItem value="1440">24 hours before</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">Cancellations after this window are considered "late"</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Flag Late Cancellations</p>
              <p className="text-xs text-gray-500">Mark as "Late Cancel" on user's record</p>
            </div>
            <Switch
              checked={config?.late_cancel_penalty_enabled !== false}
              onCheckedChange={(v) => updateConfig('late_cancel_penalty_enabled', v)}
            />
          </div>
          <div>
            <Label>Policy Text (shown to users)</Label>
            <Textarea
              className="mt-1 resize-none h-24"
              value={config?.cancellation_policy_text || ''}
              onChange={(e) => updateConfig('cancellation_policy_text', e.target.value)}
              placeholder="e.g. Please cancel at least 1 hour in advance..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Reminders */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>Automatic Slack + email reminders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Day-before reminder</p>
              <p className="text-xs text-gray-500">Send reminder the day before the session</p>
            </div>
            <Switch checked={config?.reminder_day_before !== false} onCheckedChange={(v) => updateConfig('reminder_day_before', v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">1-hour reminder</p>
              <p className="text-xs text-gray-500">Send reminder 1 hour before the session</p>
            </div>
            <Switch checked={config?.reminder_hour_before !== false} onCheckedChange={(v) => updateConfig('reminder_hour_before', v)} />
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Location</CardTitle></CardHeader>
        <CardContent>
          <Label>Location Text</Label>
          <Input className="mt-1" value={config?.location_text || ''} onChange={(e) => updateConfig('location_text', e.target.value)} placeholder="e.g. Wix Cedar Rapids — Library" />
        </CardContent>
      </Card>

      <Button onClick={saveConfig} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700">
        {saving ? <LoadingSpinner size="sm" /> : <><Save className="w-4 h-4 mr-2" /> Save All Settings</>}
      </Button>
    </div>
  );
}