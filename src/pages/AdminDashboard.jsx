import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, subDays } from "date-fns";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, Settings, Clock, TrendingUp, AlertTriangle, ArrowRight, BarChart3, CalendarDays, UserCog, FileText, User, Shield, UserPlus, MoreVertical, AlertCircle, Search, Star, Music } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import TherapistBioEditor from "@/components/admin/TherapistBioEditor";

const roleConfig = {
  user: { label: 'Employee', color: 'bg-gray-100 text-gray-700' },
  admin: { label: 'Admin', color: 'bg-blue-100 text-blue-700' },
  super_admin: { label: 'Super Admin', color: 'bg-purple-100 text-purple-700' },
  therapist: { label: 'Therapist', color: 'bg-green-100 text-green-700' }
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({ todayBookings: 0, weekBookings: 0, totalUsers: 0, noShows: 0, utilization: 0 });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [bioDialogOpen, setBioDialogOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [inviteDialog, setInviteDialog] = useState({ open: false });
  const [inviteData, setInviteData] = useState({ email: '', role: 'user' });
  const [roleDialog, setRoleDialog] = useState({ open: false, user: null, newRole: '' });
  const [inviting, setInviting] = useState(false);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const adminRoles = ['admin', 'super_admin', 'therapist'];
      if (!adminRoles.includes(currentUser.role)) {
        navigate(createPageUrl('Home'));
        return;
      }
      if (currentUser.role === 'therapist') {
        navigate(createPageUrl('TherapistView'));
        return;
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

      const allBookings = await base44.entities.Booking.list('-created_date', 1000);
      const todayBookings = allBookings.filter(b => b.date === today && ['booked', 'confirmed'].includes(b.status));
      const weekBookings = allBookings.filter(b => b.date >= weekStart && b.date <= weekEnd && !['cancelled', 'late_cancelled'].includes(b.status));
      const monthNoShows = allBookings.filter(b => b.date >= monthStart && b.status === 'no_show');

      const users = await base44.entities.User.list('-created_date');
      setAllUsers(users);

      const completedThisMonth = allBookings.filter(b => b.date >= monthStart && b.status === 'completed').length;

      setStats({
        todayBookings: todayBookings.length,
        weekBookings: weekBookings.length,
        totalUsers: users.length,
        noShows: monthNoShows.length,
        utilization: Math.round((completedThisMonth / (completedThisMonth + monthNoShows.length + 1)) * 100) || 0
      });
      setRecentBookings(allBookings.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const inviteUser = async () => {
    setInviting(true);
    const isNonWixUser = !inviteData.email.endsWith('@wix.com');
    if (isNonWixUser && inviteData.role === 'user') {
      toast({ title: "Invalid email", description: "Non-Wix emails can only be added as Therapist or Admin", variant: "destructive" });
      setInviting(false);
      return;
    }
    const platformRole = (inviteData.role === 'user') ? 'user' : 'admin';
    await base44.users.inviteUser(inviteData.email, platformRole);
    toast({ title: "Invitation sent", description: "The user can be assigned their specific role after they join." });
    setInviteDialog({ open: false });
    setInviteData({ email: '', role: 'user' });
    setInviting(false);
    loadDashboardData();
  };

  const updateUserRole = async () => {
    await base44.entities.User.update(roleDialog.user.id, { role: roleDialog.newRole });
    await base44.entities.AuditLog.create({
      action_type: 'role_change',
      admin_email: user.email,
      admin_name: user.full_name,
      target_user_email: roleDialog.user.email,
      details: JSON.stringify({ old_role: roleDialog.user.role, new_role: roleDialog.newRole })
    });
    toast({ title: "Role updated" });
    setRoleDialog({ open: false, user: null, newRole: '' });
    loadDashboardData();
  };

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = !userSearch ||
      u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const isSuperAdmin = user?.role === 'super_admin';

  const adminLinks = [
    { title: 'Schedule Management', description: 'Configure hours, slots, and breaks', icon: CalendarDays, page: 'AdminSchedule', color: 'bg-blue-500', superAdminOnly: false },
    { title: 'Booking Management', description: 'View and manage all bookings', icon: Calendar, page: 'AdminBookings', color: 'bg-green-500', superAdminOnly: false },
    { title: 'User Management', description: 'Manage roles and permissions', icon: UserCog, page: 'AdminUsers', color: 'bg-purple-500', superAdminOnly: true },
    { title: 'Settings', description: 'System configuration', icon: Settings, page: 'AdminSettings', color: 'bg-orange-500', superAdminOnly: true },
    { title: 'Therapist Feedback', description: 'View ratings and feedback from sessions', icon: Star, page: 'AdminFeedback', color: 'bg-yellow-500', superAdminOnly: true },
    { title: 'Chime Management', description: 'Preview and test user session chimes', icon: Music, page: 'AdminChimes', color: 'bg-indigo-500', superAdminOnly: false }
  ].filter(link => !link.superAdminOnly || isSuperAdmin);

  const therapistCards = [
    { title: 'Therapist View', description: 'iPad-friendly daily schedule for the therapist', icon: BarChart3, color: 'bg-teal-500', action: () => navigate(createPageUrl('TherapistView')) },
    { title: 'Therapist Bio', description: 'Edit name, title, photo, and bio shown on the landing page', icon: User, color: 'bg-pink-500', action: () => setBioDialogOpen(true) },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome back, {user?.full_name}</p>
        </div>
        {isSuperAdmin && <Badge className="bg-purple-100 text-purple-700">Super Admin</Badge>}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Today's Sessions", value: stats.todayBookings },
          { label: "This Week", value: stats.weekBookings },
          { label: "Total Users", value: stats.totalUsers },
          { label: "No Shows (Month)", value: stats.noShows },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {adminLinks.map((link) => (
          <button key={link.page} onClick={() => navigate(createPageUrl(link.page))} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-left hover:shadow-md transition-all hover:border-indigo-200">
            <div className={`w-8 h-8 rounded-lg ${link.color} flex items-center justify-center mb-3`}>
              <link.icon className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">{link.title}</h3>
            <p className="text-xs text-gray-500 mt-1">{link.description}</p>
          </button>
        ))}
        {therapistCards.map((card) => (
          <button key={card.title} onClick={card.action} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-left hover:shadow-md transition-all hover:border-indigo-200">
            <div className={`w-8 h-8 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
              <card.icon className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">{card.title}</h3>
            <p className="text-xs text-gray-500 mt-1">{card.description}</p>
          </button>
        ))}
      </div>

      {/* Dialog for Therapist Bio */}
      <Dialog open={bioDialogOpen} onOpenChange={setBioDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Therapist Bio</DialogTitle></DialogHeader>
          <TherapistBioEditor />
        </DialogContent>
      </Dialog>

      {/* User Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View, manage roles, and invite users</CardDescription>
            </div>
            <Button onClick={() => setInviteDialog({ open: true })} className="bg-indigo-600 hover:bg-indigo-700">
              <UserPlus className="w-4 h-4 mr-2" /> Invite User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">Employee</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="therapist">Therapist</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No users found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredUsers.map((u) => {
                const role = roleConfig[u.role] || roleConfig.user;
                const isNonWix = u.is_non_wix_user || !u.email?.endsWith('@wix.com');
                return (
                  <div key={u.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{getInitials(u.full_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">{u.full_name}</span>
                          {isNonWix && <Badge variant="outline" className="text-xs">External</Badge>}
                        </div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${role.color} text-xs`}>{role.label}</Badge>
                      {(isSuperAdmin || (user?.role === 'admin' && u.role !== 'super_admin')) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-3 h-3" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setRoleDialog({ open: true, user: u, newRole: u.role })}>
                              Change Role
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteDialog.open} onOpenChange={(open) => setInviteDialog({ open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email Address</label>
              <Input className="mt-1" value={inviteData.email} onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })} />
              {inviteData.email && !inviteData.email.endsWith('@wix.com') && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Non-Wix emails can only be added as Therapist or Admin</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select value={inviteData.role} onValueChange={(v) => setInviteData({ ...inviteData, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Employee</SelectItem>
                  <SelectItem value="therapist">Therapist</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialog({ open: false })}>Cancel</Button>
            <Button onClick={inviteUser} className="bg-indigo-600 hover:bg-indigo-700">{inviting ? <LoadingSpinner size="sm" /> : 'Send Invitation'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={roleDialog.open} onOpenChange={(open) => setRoleDialog({ ...roleDialog, open })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Role — {roleDialog.user?.full_name}</DialogTitle></DialogHeader>
          <Select value={roleDialog.newRole} onValueChange={(v) => setRoleDialog({ ...roleDialog, newRole: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Employee</SelectItem>
              <SelectItem value="therapist">Therapist</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog({ open: false, user: null, newRole: '' })}>Cancel</Button>
            <Button onClick={updateUserRole} className="bg-indigo-600 hover:bg-indigo-700">Update Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}