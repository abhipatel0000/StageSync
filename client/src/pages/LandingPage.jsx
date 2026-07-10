import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Key, EyeOff, Zap, Lock, RefreshCw, Smartphone, Monitor } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex-1 bg-darkbg-950 text-slate-100 flex flex-col justify-center">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 overflow-hidden">
        {/* Glow blur filters */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-none mb-6">
            Deliver Event Assets Securely{' '}
            <span className="bg-gradient-to-r from-brand-400 via-violet-400 to-indigo-400 text-transparent bg-clip-text glow-text-purple">
              Without Leaving Footprints
            </span>
          </h1>
          <p className="text-base md:text-xl text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed">
            Stop logging into your personal Google Drive, email, or WhatsApp accounts on shared venue computers. Keep your accounts on your trusted device and deliver files via temporary guest PINs.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link
              to="/register"
              className="glow-btn-purple w-full sm:w-auto px-8 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-center transition-all duration-200"
            >
              Create Organizer Account
            </Link>
            <Link
              to="/guest"
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-semibold rounded-xl text-center transition-all duration-200"
            >
              Access Event Workspace
            </Link>
          </div>
        </div>
      </section>

      {/* Visual Workflow Section */}
      <section className="py-12 px-6 bg-darkbg-900/30 border-y border-white/5 relative">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">The StageSync Workflow</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="glass-card p-6 rounded-2xl relative">
              <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div className="mt-2 flex items-center gap-3 text-slate-200 font-bold mb-3">
                <Smartphone className="w-5 h-5 text-brand-400" />
                Upload from Trusted Device
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Log into your secure account on your phone or laptop. Create an event workspace and upload presentations, PDFs, videos, or audio assets.
              </p>
            </div>

            {/* Step 2 */}
            <div className="glass-card p-6 rounded-2xl relative">
              <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div className="mt-2 flex items-center gap-3 text-slate-200 font-bold mb-3">
                <Key className="w-5 h-5 text-brand-400" />
                Generate Temporary Access
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Generate an Event Code and temporary 6-digit PIN, or display a single-use QR token. Existing account sessions are never exposed.
              </p>
            </div>

            {/* Step 3 */}
            <div className="glass-card p-6 rounded-2xl relative">
              <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div className="mt-2 flex items-center gap-3 text-slate-200 font-bold mb-3">
                <Monitor className="w-5 h-5 text-brand-400" />
                Secure Venue Download
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Enter details on the venue PC. Access only the event's files. Session cookies are HttpOnly and auto-expire once the event ends.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security Pillars */}
      <section className="py-16 px-6 max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Built Securely from the Ground Up</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-white/5 bg-slate-950/40">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-violet-400" />
            </div>
            <h3 className="font-bold text-lg mb-2">Account Isolation</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Venue operators can only view files specifically allocated to their workspace. Your master account password is never transmitted to shared machines.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/5 bg-slate-950/40">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5 text-indigo-400" />
            </div>
            <h3 className="font-bold text-lg mb-2">Short-Lived Signed URLs</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Files are stored in private secure cloud object storage. Downloads are executed via unique signed download tokens that expire within 5 minutes.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/5 bg-slate-950/40">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-bold text-lg mb-2">Instant Remote Revocation</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Lose access immediately. From your phone, track which computers are connected and revoke their guest sessions instantly, cutting download access.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/5 bg-slate-950/40">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
              <EyeOff className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="font-bold text-lg mb-2">Brute Force Defenses</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Event access PIN verification is strictly rate-limited. Too many failed attempts on an event code will temporarily lock logins to protect files.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/5 bg-slate-950/40">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-rose-400" />
            </div>
            <h3 className="font-bold text-lg mb-2">Auto-Retention Cleanups</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              No files stay in the cloud forever. Set an auto-expiration date, and background janitors will permanently erase materials from storage once closed.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/5 bg-slate-950/40">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="font-bold text-lg mb-2">Audit Logs</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Track logins, edits, and file downloads. See exactly when and from which IP addresses venue computers pulled event assets.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
