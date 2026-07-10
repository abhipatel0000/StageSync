import React, { useEffect } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Monitor } from 'lucide-react';

export default function GuestLayout() {
  const { guestSession, guestEvent, loading, logoutGuest } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!guestSession || !guestEvent)) {
      navigate('/guest');
    }
  }, [guestSession, guestEvent, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-darkbg-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!guestSession || !guestEvent) return null;

  return (
    <div className="min-h-screen bg-darkbg-950 text-slate-100 flex flex-col font-sans">
      {/* Guest Navigation Header */}
      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Monitor className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-400/5 px-2 py-0.5 rounded border border-emerald-500/10">
                Venue computer
              </span>
              <span className="text-[10px] text-slate-500">
                ({guestSession.deviceName})
              </span>
            </div>
            <p className="text-sm font-bold text-slate-100 mt-0.5 truncate max-w-xs sm:max-w-md">
              {guestEvent.name}
            </p>
          </div>
        </div>

        <button
          onClick={async () => {
            await logoutGuest();
            navigate('/guest');
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Disconnect
        </button>
      </header>

      {/* Main Guest Content */}
      <main className="flex-1 flex flex-col max-w-6xl w-full mx-auto p-6 md:p-8">
        <Outlet />
      </main>

      <footer className="py-6 border-t border-white/5 text-center text-[10px] text-slate-600 bg-darkbg-950">
        StageSync Temporary Session. Access will automatically expire when event access window closes.
      </footer>
    </div>
  );
}
