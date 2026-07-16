import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

// Storage keys
const GUEST_TOKEN_KEY = 'stagesync_guest_token';
const ACCESS_TOKEN_KEY = 'stagesync_access_token';
const REFRESH_TOKEN_KEY = 'stagesync_refresh_token';

// Attach guest token to all requests via X-Guest-Token header
function setGuestTokenHeader(token) {
  if (token) {
    client.defaults.headers.common['X-Guest-Token'] = token;
  } else {
    delete client.defaults.headers.common['X-Guest-Token'];
  }
}

// Save organizer tokens to localStorage (cross-domain mobile fallback)
function saveOrganizerTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

// Clear organizer tokens from localStorage
function clearOrganizerTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [guestSession, setGuestSession] = useState(null);
  const [guestEvent, setGuestEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check initial logins on mount
  useEffect(() => {
    const initializeAuth = async () => {
      // 1. Try to load Organizer profile if we have a stored access token
      const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (storedToken) {
        try {
          const organizerRes = await client.get('/auth/me');
          if (organizerRes.data.success) {
            setUser(organizerRes.data.data.user);
          }
        } catch (e) {
          // Access token expired — try to refresh silently using stored refresh token
          try {
            const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
            const refreshRes = await client.post('/auth/refresh', { refreshToken });
            if (refreshRes.data?.data?.accessToken) {
              saveOrganizerTokens(
                refreshRes.data.data.accessToken,
                refreshRes.data.data.refreshToken
              );
              // Retry loading user after token refresh
              const retryRes = await client.get('/auth/me');
              if (retryRes.data.success) {
                setUser(retryRes.data.data.user);
              }
            }
          } catch {
            // Refresh also failed — clear tokens and stay logged out
            clearOrganizerTokens();
          }
        }
      }

      // 2. Restore guest session token from localStorage
      try {
        const storedGuestToken = localStorage.getItem(GUEST_TOKEN_KEY);
        if (storedGuestToken) {
          setGuestTokenHeader(storedGuestToken);
          const guestRes = await client.get('/guest/event');
          if (guestRes.data.success) {
            setGuestSession(guestRes.data.data.session);
            setGuestEvent(guestRes.data.data.event);
          } else {
            localStorage.removeItem(GUEST_TOKEN_KEY);
            setGuestTokenHeader(null);
          }
        }
      } catch (e) {
        localStorage.removeItem(GUEST_TOKEN_KEY);
        setGuestTokenHeader(null);
      }

      setLoading(false);
    };

    initializeAuth();

    // Listen for dead refresh tokens to trigger logout
    const handleLogoutEvent = () => {
      setUser(null);
      clearOrganizerTokens();
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
        // Save tokens to localStorage for cross-domain mobile support
        saveOrganizerTokens(
          res.data.data.accessToken,
          res.data.data.refreshToken
        );
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
        // Save tokens to localStorage for cross-domain mobile support
        saveOrganizerTokens(
          res.data.data.accessToken,
          res.data.data.refreshToken
        );
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
      clearOrganizerTokens();
      setUser(null);
    }
  };

  // Guest auth operations
  const authenticateGuest = async (eventCode, pin) => {
    try {
      const res = await client.post('/guest/authenticate', { eventCode, pin });
      if (res.data.success) {
        const token = res.data.data.sessionToken;
        if (token) {
          localStorage.setItem(GUEST_TOKEN_KEY, token);
          setGuestTokenHeader(token);
        }
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
        const sessionToken = res.data.data.sessionToken;
        if (sessionToken) {
          localStorage.setItem(GUEST_TOKEN_KEY, sessionToken);
          setGuestTokenHeader(sessionToken);
        }
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
      localStorage.removeItem(GUEST_TOKEN_KEY);
      setGuestTokenHeader(null);
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
