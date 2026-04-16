import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Search, User, Shield, UserPlus, MoreVertical, AlertCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const roleConfig = {
  user: { label: 'Employee', color: 'bg-gray-100 text-gray-700' },
  admin: { label: 'Admin', color: 'bg-blue-100 text-blue-700' },
  super_admin: { label: 'Super Admin', color: 'bg-purple-100 text-purple-700' },
  therapist: { label: 'Therapist', color: 'bg-green-100 text-green-700' }
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [inviteDialog, setInviteDialog] = useState({ open: false });
  const [inviteData, setInviteData] = useState({ email: '', role: 'user' });
  const [roleDialog, setRoleDialog] = useState({ open: false, user: null, newRole: '' });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, roleFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      setCurrentUser(me);
      if (me.role !== 'super_admin') {
        navigate(createPageUrl('AdminDashboard'));
        return;
      }
      const allUsers = await base44.entities.User.list('-created_date');
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u =>
        u.full_name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query)
      );
    }
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }
    setFilteredUsers(filtered);
  };

  const inviteUser = async () => {
    setInviting(true);
    const isNonWixUser = !inviteData.email.endsWith('@wix.com');
    if (isNonWixUser && inviteData.role === 'user') {
      toast({ title: "Invalid email", description: "Non-Wix email addresses can only be added as Therapist or Admin", variant: "destructive" });
      setInviting(false);
      return;
    }
    await base44.users.inviteUser(inviteData.email, inviteData.role);
    toast({ title: "Invitation sent" });
    setInviteDialog({ open: false });
    setInviteData({ email: '', role: 'user' });
    setInviting(false);
    loadData();
  };

  const updateUserRole = async () => {
    if (roleDialog.user.role === 'super_admin' && currentUser.role !== 'super_admin') {
      toast({ title: "Permission denied", description: "Only Super Admins can modify other Super Admins", variant: "destructive" });
      return;
    }
    await base44.entities.User.update(roleDialog.user.id, { role: roleDialog.newRole });
    await base44.entities.AuditLog.create({
      action_type: 'role_change',
      admin_email: currentUser.email,
      admin_name: currentUser.full_name,
      target_user_email: roleDialog.user.email,
      details: JSON.stringify({ old_role: roleDialog.user.role, new_role: roleDialog.newRole })
    });
    toast({ title: "Role updated" });
    setRoleDialog({ open: false, user: null, newRole: '' });
    loadData();
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => navigate(createPageUrl('AdminDashboard'))} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <Button onClick={() => setInviteDialog({ open: true })} className="bg-indigo-600 hover:bg-indigo-700">
          <UserPlus className="w-4 h-4 mr-2" /> Invite User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="user">Employee</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="therapist">Therapist</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users List */}
      <Card>
        <CardContent className="p-0">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No users found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredUsers.map((user) => {
                const role = roleConfig[user.role] || roleConfig.user;
                const isNonWix = user.is_non_wix_user || !user.email?.endsWith('@wix.com');
                return (
                  <div key={user.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{user.full_name}</span>
                          {isNonWix && <Badge variant="outline" className="text-xs">External</Badge>}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={role.color}>{role.label}</Badge>
                      {(isSuperAdmin || (currentUser?.role === 'admin' && user.role !== 'super_admin')) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setRoleDialog({ open: true, user, newRole: user.role })}>
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
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>Send an invitation to join the massage booking system</DialogDescription>
          </DialogHeader>
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
          <DialogHeader>
            <DialogTitle>Change Role — {roleDialog.user?.full_name}</DialogTitle>
          </DialogHeader>
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