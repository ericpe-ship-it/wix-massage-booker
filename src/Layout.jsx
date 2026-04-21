import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import Navbar from '@/components/layout/Navbar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const currentUser = await base44.auth.me();

          // Check if user has allowed email domain
          const isAllowedDomain = currentUser.email?.endsWith('@base44.com') || currentUser.email?.endsWith('@wix.com');

          if (isAllowedDomain) {
            setUser(currentUser);
            setAuthorized(true);

            // Auto-initialize new users only (no role assigned yet)
            if (!currentUser.role) {
              await base44.auth.updateMe({
                role: 'user',
                is_active: true,
                no_show_count: 0,
                late_cancellation_count: 0,
                total_bookings: 0
              });
            }
          } else {
            // User not authorized - set to show error
            setUser(currentUser);
            setAuthorized(false);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const handleLogout = () => {
    base44.auth.logout();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Block non-authorized users
  if (user && !authorized) {
    return <UserNotRegisteredError />;
  }

  // Pages that don't need navbar (like therapist view in fullscreen mode)
  const fullscreenPages = ['TherapistView'];
  const isFullscreen = fullscreenPages.includes(currentPageName);

  return (
    <div className="min-h-screen bg-gray-50">
      {!isFullscreen && <Navbar user={user} onLogout={handleLogout} currentPageName={currentPageName} />}
      <main>
        {children}
      </main>
    </div>
  );
}