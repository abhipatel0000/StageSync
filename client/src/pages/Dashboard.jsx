import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { Calendar, HardDrive, Monitor, Download, ShieldAlert, Plus, RefreshCw, Clock } from 'lucide-react';

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const res = await client.get('/dashboard/activity');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const stats = data?.stats || { activeEvents: 0, upcomingEvents: 0, expiredEvents: 0, totalEvents: 0, storageBytes: 0 };
  const recentSessions = data?.recentSessions || [];
  const recentDownloads = data?.recentDownloads || [];
  const recentAudits = data?.recentAudits || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Organizer Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Overview of your workspaces, connected venue sessions, and uploads.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="p-3 bg-slate-900 border border-white/5 hover:border-white/10 text-slate-300 hover:text-white rounded-xl transition-all disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/events?create=true"
            className="glow-btn-purple flex items-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Event
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Events */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Calendar className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Events</p>
            <h3 className="text-2xl font-bold text-slate-100 mt-1">{stats.activeEvents}</h3>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Upcoming</p>
            <h3 className="text-2xl font-bold text-slate-100 mt-1">{stats.upcomingEvents}</h3>
          </div>
        </div>

        {/* Expired Events */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-500/10 border border-white/5 flex items-center justify-center text-slate-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Expired / Archived</p>
            <h3 className="text-2xl font-bold text-slate-100 mt-1">{stats.expiredEvents}</h3>
          </div>
        </div>

        {/* Storage */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Storage Used</p>
            <h3 className="text-2xl font-bold text-slate-100 mt-1">{formatBytes(stats.storageBytes)}</h3>
          </div>
        </div>
      </div>

      {/* Activity Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Connected Devices */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col h-[380px]">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Monitor className="w-5 h-5 text-emerald-400" />
              Connected Venue Devices
            </h2>
            <span className="text-xs text-slate-500 uppercase tracking-wider">Recent logins</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
            {recentSessions.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No active venue computers connected.
              </div>
            ) : (
              recentSessions.map((session, i) => (
                <div key={i} className="p-3 bg-slate-950/40 border border-white/5 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{session.deviceName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Event: <Link to={`/events/${session.eventPublicId}`} className="text-brand-400 hover:underline">{session.eventName}</Link>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-mono">{session.ipAddress}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(session.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Download Activity */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col h-[380px]">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Download className="w-5 h-5 text-brand-400" />
              Asset Downloads
            </h2>
            <span className="text-xs text-slate-500 uppercase tracking-wider">Recent pulls</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
            {recentDownloads.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No files downloaded yet.
              </div>
            ) : (
              recentDownloads.map((log, i) => (
                <div key={i} className="p-3 bg-slate-950/40 border border-white/5 rounded-xl flex items-center justify-between">
                  <div className="truncate max-w-[70%]">
                    <p className="text-sm font-semibold text-slate-200 truncate">{log.fileName}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      Event: <Link to={`/events/${log.eventPublicId}`} className="text-brand-400 hover:underline">{log.eventName}</Link>
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500 text-right">{formatDate(log.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Security Logs */}
        <div className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col h-[320px] lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Security Audit Trail
            </h2>
            <span className="text-xs text-slate-500 uppercase tracking-wider">Admin logs</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {recentAudits.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No security audit events logged yet.
              </div>
            ) : (
              recentAudits.map((audit, i) => (
                <div key={i} className="p-2.5 bg-slate-950/40 border border-white/5 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded font-semibold text-[10px] uppercase ${
                      audit.action.includes('REGENERATED') || audit.action.includes('REVOKED') || audit.action.includes('DELETED')
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                    }`}>
                      {audit.action}
                    </span>
                    <span className="text-slate-400">
                      {audit.eventName ? `Event: ${audit.eventName}` : 'System administrative action'}
                    </span>
                  </div>
                  <div className="text-right text-[10px] text-slate-500">
                    <span>IP: {audit.ipAddress}</span> &bull; <span>{formatDate(audit.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
