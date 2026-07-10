import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [guestSession, setGuestSession] = useState(null);
  const [guestEvent, setGuestEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check initial logins on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // 1. Try to load Organizer profile
        const organizerRes = await client.get('/auth/me');
        if (organizerRes.data.success) {
          setUser(organizerRes.data.data.user);
        }
      } catch (e) {
        // Ignore, means not logged in as organizer
      }

      try {
        // 2. Try to load Guest event session
        const guestRes = await client.get('/guest/event');
        if (guestRes.data.success) {
          setGuestSession(guestRes.data.data.session);
          setGuestEvent(guestRes.data.data.event);
        }
      } catch (e) {
        // Ignore, means not logged in as guest
      }

      setLoading(false);
    };

    initializeAuth();

    // Listen for dead refresh tokens to trigger logout
    const handleLogoutEvent = () => {
      setUser(null);
    };

    window.addEventListener('stagesync-logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('stagesync-logout', handleLogoutEvent);
    };
  }, []);

  // Organizer auth operations
  const loginOrganizer = async (email, password) => {
    setLoading(true);
    try {
      const res = await client.post('/auth/login', { email, password });
      if (res.data.success) {
        setUser(res.data.data.user);
        return { success: true };
      }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || 'Login failed.'
      };
    } finally {
      setLoading(false);
    }
  };

  const registerOrganizer = async (fullName, email, password) => {
    setLoading(true);
    try {
      const res = await client.post('/auth/register', { fullName, email, password });
      if (res.data.success) {
        setUser(res.data.data.user);
        return { success: true };
      }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || 'Registration failed.'
      };
    } finally {
      setLoading(false);
    }
  };

  const logoutOrganizer = async () => {
    try {
      await client.post('/auth/logout');
    } catch (e) {
      // Proceed to clear local state anyway
    } finally {
      setUser(null);
    }
  };

  // Guest auth operations
  const authenticateGuest = async (eventCode, pin) => {
    try {
      const res = await client.post('/guest/authenticate', { eventCode, pin });
      if (res.data.success) {
        setGuestSession(res.data.data.session);
        setGuestEvent(res.data.data.event);
        return { success: true };
      }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || 'Guest authentication failed.'
      };
    }
  };

  const authenticateGuestQr = async (token) => {
    try {
      const res = await client.post('/guest/authenticate-qr', { token });
      if (res.data.success) {
        setGuestSession(res.data.data.session);
        setGuestEvent(res.data.data.event);
        return { success: true };
      }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error?.message || 'QR authentication failed.'
      };
    }
  };

  const logoutGuest = async () => {
    try {
      await client.post('/guest/logout');
    } catch (e) {
      // Ignore
    } finally {
      setGuestSession(null);
      setGuestEvent(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        guestSession,
        guestEvent,
        loading,
        loginOrganizer,
        registerOrganizer,
        logoutOrganizer,
        authenticateGuest,
        authenticateGuestQr,
        logoutGuest
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
