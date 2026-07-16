let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// Automatically append /api/v1 if the user omitted it in their environment variable
if (API_URL && !API_URL.endsWith('/api/v1') && !API_URL.endsWith('/api/v1/')) {
  API_URL = API_URL.endsWith('/') ? `${API_URL}api/v1` : `${API_URL}/api/v1`;
}

import axios from 'axios';

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor: inject access token + guest token on every request
client.interceptors.request.use((config) => {
  // Inject organizer access token as Bearer header (works on all browsers/mobile, unlike cross-site cookies)
  const accessToken = localStorage.getItem('stagesync_access_token');
  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Inject guest token if present
  const guestToken = localStorage.getItem('stagesync_guest_token');
  if (guestToken) {
    config.headers['X-Guest-Token'] = guestToken;
  }

  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: only attempt token refresh for organizer routes, never for guest routes
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip interceptor for auth endpoints to avoid infinite loops
    if (
      originalRequest.url.includes('/auth/login') ||
      originalRequest.url.includes('/auth/register') ||
      originalRequest.url.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    // Skip token refresh entirely for guest routes — they use X-Guest-Token, not JWT cookies
    if (originalRequest.url.includes('/guest/')) {
      return Promise.reject(error);
    }

    // Handle expired organizer session (401 Unauthorized) — attempt JWT refresh
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return client(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Send stored refresh token in request body (cookie fallback for cross-domain mobile)
        const refreshToken = localStorage.getItem('stagesync_refresh_token');
        const refreshRes = await client.post('/auth/refresh', { refreshToken });

        // Store new tokens from response body
        if (refreshRes.data?.data?.accessToken) {
          localStorage.setItem('stagesync_access_token', refreshRes.data.data.accessToken);
        }
        if (refreshRes.data?.data?.refreshToken) {
          localStorage.setItem('stagesync_refresh_token', refreshRes.data.data.refreshToken);
        }

        isRefreshing = false;
        processQueue(null);

        // Retry original request
        return client(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);

        // Clear stored tokens on refresh failure
        localStorage.removeItem('stagesync_access_token');
        localStorage.removeItem('stagesync_refresh_token');

        // Trigger event to redirect to login if refresh token is dead
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('stagesync-logout'));
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default client;
