import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Menu, X, Calendar, BookOpen, User, LogOut, Settings, Heart } from 'lucide-react';

const navLinks = [
  { label: 'Home', page: 'Home', icon: Heart },
  { label: 'Book', page: 'Book', icon: Calendar },
  { label: 'My Bookings', page: 'MyBookings', icon: BookOpen },
  { label: 'How It Works', page: 'HowItWorks', icon: BookOpen },
];

const adminLinks = [
  { label: 'Admin', page: 'AdminDashboard', icon: Settings },
];

export default function Navbar({ user, onLogout, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isTherapist = user?.role === 'therapist';

  const allLinks = isAdmin
    ? [...navLinks, ...adminLinks]
    : isTherapist
    ? [{ label: 'Schedule', page: 'TherapistView', icon: Calendar }, { label: 'Clients', page: 'TherapistClients', icon: User }]
    : navLinks;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="font-bold text-indigo-600 text-lg">
            💆 Wix Massage
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-1">
            {allLinks.map(link => (
              <Link
                key={link.page}
                to={createPageUrl(link.page)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPageName === link.page
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* User + Logout */}
          <div className="hidden md:flex items-center gap-2">
            <Link to={createPageUrl('MyProfile')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-600">
                {user?.full_name?.[0] || '?'}
              </div>
              <span className="text-sm text-gray-700">{user?.full_name?.split(' ')[0]}</span>
            </Link>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-gray-500">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1">
          {allLinks.map(link => (
            <Link
              key={link.page}
              to={createPageUrl(link.page)}
              onClick={() => setMobileOpen(false)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                currentPageName === link.page
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link to={createPageUrl('MyProfile')} onClick={() => setMobileOpen(false)} className="px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">
            My Profile
          </Link>
          <button onClick={onLogout} className="px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-lg text-left">
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}