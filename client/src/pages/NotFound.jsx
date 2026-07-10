import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-darkbg-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-brand-500/10 rounded-full blur-[90px] pointer-events-none"></div>

      <div className="glass-card max-w-md p-8 rounded-3xl border border-white/5 relative z-10">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6 text-rose-400">
          <AlertCircle className="w-8 h-8" />
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight mb-2">404</h1>
        <h2 className="text-xl font-bold mb-4">Page Not Found</h2>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          The link you followed may be broken or the page may have been removed. If you are accessing a temporary guest session, ensure the session has not expired.
        </p>

        <Link
          to={user ? "/dashboard" : "/"}
          className="glow-btn-purple inline-block w-full py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm transition-all"
        >
          {user ? "Back to Dashboard" : "Back to Home"}
        </Link>
      </div>
    </div>
  );
}
