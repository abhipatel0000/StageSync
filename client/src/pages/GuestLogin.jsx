import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Monitor, Key, Lock, AlertCircle, Sparkles } from 'lucide-react';

export default function GuestLogin() {
  const [eventCode, setEventCode] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { guestSession, authenticateGuest, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated as guest
  useEffect(() => {
    if (!loading && guestSession) {
      navigate('/guest/workspace');
    }
  }, [guestSession, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!eventCode || !pin) {
      setErrorMsg('Please enter both the Event Code and verification PIN.');
      return;
    }

    setIsSubmitting(true);
    const result = await authenticateGuest(eventCode, pin);
    setIsSubmitting(false);

    if (result && result.success) {
      navigate('/guest/workspace');
    } else if (result) {
      setErrorMsg(result.error);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12 relative bg-darkbg-950">
      {/* Glow background filter */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-[110px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-card p-8 rounded-3xl border border-white/5 relative z-10">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-emerald-400">
            <Monitor className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Venue Guest Access</h2>
          <p className="text-xs text-slate-400 mt-2">
            Enter event code and temporary PIN to download files securely.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-xs text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Event Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Event Access Code
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <Sparkles className="w-5 h-5 text-slate-500" />
              </span>
              <input
                type="text"
                value={eventCode}
                onChange={(e) => setEventCode(e.target.value)}
                className="glass-input w-full pl-11 pr-4 py-3 rounded-xl text-slate-200 text-sm font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal uppercase"
                placeholder="e.g. EV-A7K9P2"
                required
                disabled={isSubmitting}
                autoFocus
              />
            </div>
          </div>

          {/* Verification PIN */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Verification PIN
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <Lock className="w-5 h-5 text-slate-500" />
              </span>
              <input
                type="password"
                maxLength="6"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                className="glass-input w-full pl-11 pr-4 py-3 rounded-xl text-slate-200 text-sm font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal"
                placeholder="6-digit PIN"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/10 focus:outline-none"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Key className="w-4 h-4" />
                Authenticate Device
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500 border-t border-white/5 pt-6">
          <Link to="/login" className="hover:text-slate-400 transition-colors">
            Organizer Sign In &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
