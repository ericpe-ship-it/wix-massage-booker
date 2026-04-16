import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './Layout';

import Home from './pages/Home';
import Book from './pages/Book';
import MyBookings from './pages/MyBookings';
import MyProfile from './pages/MyProfile';
import HowItWorks from './pages/HowItWorks';
import AdminBookings from './pages/AdminBookings';
import AdminDashboard from './pages/AdminDashboard';
import AdminFeedback from './pages/AdminFeedback';
import AdminSchedule from './pages/AdminSchedule';
import AdminSettings from './pages/AdminSettings';
import AdminUsers from './pages/AdminUsers';
import TherapistClients from './pages/TherapistClients';
import TherapistView from './pages/TherapistView';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Layout currentPageName="Home"><Home /></Layout>} />
      <Route path="/Home" element={<Layout currentPageName="Home"><Home /></Layout>} />
      <Route path="/Book" element={<Layout currentPageName="Book"><Book /></Layout>} />
      <Route path="/MyBookings" element={<Layout currentPageName="MyBookings"><MyBookings /></Layout>} />
      <Route path="/MyProfile" element={<Layout currentPageName="MyProfile"><MyProfile /></Layout>} />
      <Route path="/HowItWorks" element={<Layout currentPageName="HowItWorks"><HowItWorks /></Layout>} />
      <Route path="/AdminBookings" element={<Layout currentPageName="AdminBookings"><AdminBookings /></Layout>} />
      <Route path="/AdminDashboard" element={<Layout currentPageName="AdminDashboard"><AdminDashboard /></Layout>} />
      <Route path="/AdminFeedback" element={<Layout currentPageName="AdminFeedback"><AdminFeedback /></Layout>} />
      <Route path="/AdminSchedule" element={<Layout currentPageName="AdminSchedule"><AdminSchedule /></Layout>} />
      <Route path="/AdminSettings" element={<Layout currentPageName="AdminSettings"><AdminSettings /></Layout>} />
      <Route path="/AdminUsers" element={<Layout currentPageName="AdminUsers"><AdminUsers /></Layout>} />
      <Route path="/TherapistClients" element={<Layout currentPageName="TherapistClients"><TherapistClients /></Layout>} />
      <Route path="/TherapistView" element={<Layout currentPageName="TherapistView"><TherapistView /></Layout>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App