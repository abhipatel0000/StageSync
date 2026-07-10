import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicLayout() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-darkbg-950 text-slate-100 flex flex-col font-sans">
      <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/5">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-wider text-slate-100 uppercase hover:opacity-90">
          <span className="bg-gradient-to-r from-violet-500 to-indigo-500 text-transparent bg-clip-text font-extrabold">Stage</span>
          <span className="text-violet-400 font-semibold">Sync</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link to="/guest" className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">
            Venue Login
          </Link>
          {user ? (
            <Link to="/dashboard" className="glow-btn-purple px-4 py-2 bg-brand-600 hover:bg-brand-500 text-sm font-medium text-white rounded-lg transition-all">
              Go to Dashboard
            </Link>
          ) : (
            <Link to="/login" className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">
              Organizer Login
            </Link>
          )}
        </nav>
      </header>
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      <footer className="py-8 border-t border-white/5 text-center text-xs text-slate-500 bg-darkbg-950">
        &copy; {new Date().getFullYear()} StageSync. Built for secure physical event content delivery.
      </footer>
    </div>
  );
}
