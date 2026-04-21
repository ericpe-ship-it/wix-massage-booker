import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Menu, X, MapPin, LogOut, ChevronRight } from 'lucide-react';

const navLinks = [
  { label: 'How It Works', page: 'HowItWorks' },
  { label: 'Book', page: 'Book' },
  { label: 'My Bookings', page: 'MyBookings' },
];

const adminLinks = [
  { label: 'Admin', page: 'AdminDashboard' },
];

export default function Navbar({ user, onLogout, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    base44.entities.ScheduleConfig.list().then(cfgs => {
      if (cfgs.length > 0) setConfig(cfgs[0]);
    });
  }, []);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isTherapist = user?.role === 'therapist';

  const allLinks = isTherapist
    ? [{ label: 'Schedule', page: 'TherapistView' }, { label: 'Clients', page: 'TherapistClients' }]
    : isAdmin
    ? [...navLinks, ...adminLinks]
    : navLinks;

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const slotDuration = config?.slot_duration_minutes;
  const subtitle = slotDuration ? `sessions every 2 weeks · ${slotDuration} min slots` : null;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      {/* Main bar */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-6">

          {/* Left: Logo card + title block */}
          <Link to="/" className="flex items-center gap-4 flex-shrink-0 group">
            {/* Mini logo card */}
            <div className="relative w-[72px] h-[48px] rounded-lg bg-[#b8b0f0] overflow-hidden flex-shrink-0 select-none">
              {/* Corner labels */}
              <span className="absolute top-1 left-1.5 text-[6px] font-semibold text-[#2d4a4a] opacity-80 tracking-wide">WIX</span>
              <span className="absolute top-1 right-1.5 text-[6px] font-semibold text-[#2d4a4a] opacity-80 tracking-wide">NYC</span>
              <span className="absolute bottom-1 left-1.5 text-[5px] font-medium text-[#2d4a4a] opacity-70 tracking-widest">MAKE</span>
              <span className="absolute bottom-1 right-1.5 text-[5px] font-medium text-[#2d4a4a] opacity-70 tracking-widest">PRIORITY</span>
              {/* Teal leaf shape */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg viewBox="0 0 72 48" className="w-full h-full" fill="none">
                  <ellipse cx="36" cy="30" rx="18" ry="22" fill="#1e4a4a" transform="rotate(-20 36 30)" />
                  <ellipse cx="28" cy="20" rx="12" ry="18" fill="#1e4a4a" transform="rotate(15 28 20)" />
                </svg>
              </div>
              {/* "MONTHLY MASSAGES" text overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="text-[8px] font-extrabold text-white tracking-tight drop-shadow">MONTHLY</span>
                <span className="text-[8px] font-extrabold text-white tracking-tight drop-shadow">MASSAGES</span>
              </div>
            </div>

            {/* Title + subtitle */}
            <div>
              <div className="flex items-center gap-1 text-xs text-indigo-500 font-medium mb-0.5">
                <MapPin className="w-3 h-3" />
                {config?.location_text || 'Wix Cedar Rapids — Library'}
              </div>
              <div className="text-lg font-bold text-gray-900 leading-tight">Chair Massage Schedule</div>
              {subtitle && <div className="text-xs text-gray-400">{subtitle}</div>}
            </div>
          </Link>

          {/* Center: Nav links (desktop) */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {allLinks.map(link => (
              <Link
                key={link.page}
                to={createPageUrl(link.page)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  currentPageName === link.page
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right: User avatar + logout */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <Link to={createPageUrl('MyProfile')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                {initials}
              </div>
              <span className="text-sm font-medium text-gray-700">{user?.full_name?.split(' ')[0]}</span>
            </Link>
            <button onClick={onLogout} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1">
          {allLinks.map(link => (
            <Link
              key={link.page}
              to={createPageUrl(link.page)}
              onClick={() => setMobileOpen(false)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                currentPageName === link.page
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {link.label}
              <ChevronRight className="w-4 h-4 opacity-40" />
            </Link>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-2 flex items-center justify-between">
            <Link to={createPageUrl('MyProfile')} onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                {initials}
              </div>
              <span className="text-sm text-gray-700">{user?.full_name}</span>
            </Link>
            <button onClick={onLogout} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}