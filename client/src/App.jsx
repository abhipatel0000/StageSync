import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import OrganizerLayout from './layouts/OrganizerLayout';
import GuestLayout from './layouts/GuestLayout';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import GuestLogin from './pages/GuestLogin';
import GuestQrLogin from './pages/GuestQrLogin';
import Dashboard from './pages/Dashboard';
import EventsList from './pages/EventsList';
import EventDetails from './pages/EventDetails';
import Settings from './pages/Settings';
import GuestWorkspace from './pages/GuestWorkspace';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<Login />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="guest" element={<GuestLogin />} />
            <Route path="guest/qr-login" element={<GuestQrLogin />} />
          </Route>

          {/* Organizer Protected Routes */}
          <Route path="/" element={<OrganizerLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="events" element={<EventsList />} />
            <Route path="events/:eventId" element={<EventDetails />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Guest Protected Routes */}
          <Route path="/" element={<GuestLayout />}>
            <Route path="guest/workspace" element={<GuestWorkspace />} />
          </Route>

          {/* fallback 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
