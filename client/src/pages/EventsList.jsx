import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { Calendar, Plus, Search, MapPin, Key, Clock, Copy, Check, X, AlertCircle } from 'lucide-react';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EventsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [accessStartsAt, setAccessStartsAt] = useState('');
  const [accessExpiresAt, setAccessExpiresAt] = useState('');
  const [maxGuestSessions, setMaxGuestSessions] = useState(5);
  const [allowDownload, setAllowDownload] = useState(true);
  const [allowDownloadAll, setAllowDownloadAll] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Credentials Reveal Modal
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  // Sync create query param from URL
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      // Set default dates
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // Default string formats
      const dateStr = today.toISOString().split('T')[0];
      
      const startStr = new Date(today.getTime() + 10 * 60 * 1000).toISOString().slice(0, 16); // 10 mins from now
      const expireStr = new Date(today.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 16); // 5 hours from now

      setEventDate(dateStr);
      setAccessStartsAt(startStr);
      setAccessExpiresAt(expireStr);
      
      setShowCreateModal(true);
      // Clear param to avoid reopening on refresh
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await client.get('/events');
      if (res.data.success) {
        setEvents(res.data.data.events);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch events. Please reload.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setError('');

    if (!name || !eventDate || !accessStartsAt || !accessExpiresAt) {
      setError('Please fill in all required fields.');
      return;
    }

    if (new Date(accessStartsAt) >= new Date(accessExpiresAt)) {
      setError('Access start time must be before the expiration time.');
      return;
    }

    try {
      setIsCreating(true);
      const res = await client.post('/events', {
        name,
        description,
        venueName,
        eventDate,
        accessStartsAt,
        accessExpiresAt,
        maxGuestSessions: parseInt(maxGuestSessions),
        allowDownload,
        allowDownloadAll
      });

      if (res.data.success) {
        setCreatedCreds(res.data.data.credentials);
        setShowCreateModal(false);
        setShowCredsModal(true);
        fetchEvents(); // Refresh list

        // Reset form
        setName('');
        setDescription('');
        setVenueName('');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Failed to create event.');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">My Events</h1>
          <p className="text-sm text-slate-400 mt-1">Manage event workspaces, file delivery directories, and venue credentials.</p>
        </div>
        <button
          onClick={() => {
            const today = new Date();
            setEventDate(today.toISOString().split('T')[0]);
            setAccessStartsAt(new Date(today.getTime() + 5 * 60 * 1000).toISOString().slice(0, 16));
            setAccessExpiresAt(new Date(today.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16));
            setShowCreateModal(true);
          }}
          className="glow-btn-purple flex items-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Events Grid */}
      {events.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl border border-white/5 text-center max-w-lg mx-auto">
          <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-200">No events found</h3>
          <p className="text-sm text-slate-400 mt-2">Get started by creating your first event workspace and credentials.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl transition-all"
          >
            Create Event
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const starts = new Date(event.accessStartsAt);
            const expires = new Date(event.accessExpiresAt);
            const now = new Date();

            let statusLabel = 'EXPIRED';
            let statusColor = 'bg-slate-500/10 text-slate-400 border-slate-500/25';
            
            if (event.status === 'ARCHIVED') {
              statusLabel = 'ARCHIVED';
              statusColor = 'bg-amber-500/10 text-amber-400 border-amber-500/25';
            } else if (now < starts) {
              statusLabel = 'UPCOMING';
              statusColor = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25 animate-pulse';
            } else if (now >= starts && now <= expires) {
              statusLabel = 'ACTIVE';
              statusColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
            }

            return (
              <Link
                to={`/events/${event.publicId}`}
                key={event.publicId}
                className="glass-card p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:-translate-y-1 hover:border-brand-500/30 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor}`}>
                      {statusLabel}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      CODE: {event.eventCode || 'NONE'}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-100 group-hover:text-brand-300 transition-colors truncate">
                    {event.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 h-8">
                    {event.description || 'No description provided.'}
                  </p>
                </div>

                <div className="border-t border-white/5 pt-4 mt-4 space-y-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{event.venueName || 'Unspecified Venue'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{formatDate(event.eventDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Expires: {new Date(event.accessExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-darkbg-900 border border-white/10 rounded-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-bold mb-6 text-slate-100">Create Event Workspace</h2>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Event Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-slate-200 text-sm"
                  placeholder="e.g. Wednesday Live Session"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="glass-input w-full px-4 py-2.5 rounded-xl text-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Venue Name
                  </label>
                  <input
                    type="text"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    className="glass-input w-full px-4 py-2.5 rounded-xl text-slate-200 text-sm"
                    placeholder="e.g. Auditorium Hall A"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-slate-200 text-sm h-20 resize-none"
                  placeholder="Brief summary of the event activities..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Access Window Opens *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={accessStartsAt}
                    onChange={(e) => setAccessStartsAt(e.target.value)}
                    className="glass-input w-full px-4 py-2.5 rounded-xl text-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Access Window Closes *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={accessExpiresAt}
                    onChange={(e) => setAccessExpiresAt(e.target.value)}
                    className="glass-input w-full px-4 py-2.5 rounded-xl text-slate-200 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Max Guest Devices
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={maxGuestSessions}
                    onChange={(e) => setMaxGuestSessions(e.target.value)}
                    className="glass-input w-full px-4 py-2.5 rounded-xl text-slate-200 text-sm"
                  />
                </div>
                <div className="flex flex-col justify-end space-y-2 pb-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={allowDownload}
                      onChange={(e) => setAllowDownload(e.target.checked)}
                      className="rounded bg-slate-900 border-white/10 text-brand-600 focus:ring-0 focus:ring-offset-0"
                    />
                    Allow file downloads
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={allowDownloadAll}
                      onChange={(e) => setAllowDownloadAll(e.target.checked)}
                      className="rounded bg-slate-900 border-white/10 text-brand-600 focus:ring-0 focus:ring-offset-0"
                    />
                    Allow "Download All" package
                  </label>
                </div>
              </div>

              <div className="flex gap-4 border-t border-white/5 pt-6 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-900/80 border border-white/10 text-slate-300 font-semibold rounded-xl text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="glow-btn-purple flex-1 py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  {isCreating ? 'Creating Workspace...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Reveal Modal */}
      {showCredsModal && createdCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md bg-darkbg-900 border border-white/10 rounded-3xl p-8 text-center relative max-h-[90vh] overflow-y-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 text-emerald-400">
              <Key className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-bold mb-2 text-slate-100">Event Workspace Ready</h2>
            <p className="text-sm text-slate-400 mb-6">
              Use these temporary credentials on the venue computer. Share them only with the AV operators.
            </p>

            <div className="space-y-4 mb-8">
              {/* Event Code */}
              <div className="p-4 bg-slate-950/40 border border-white/5 rounded-2xl text-left">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Event Code</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xl font-mono font-bold text-slate-200 tracking-wide">
                    {createdCreds.eventCode}
                  </span>
                  <button
                    onClick={() => copyToClipboard(createdCreds.eventCode, 'code')}
                    className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Temporary PIN */}
              <div className="p-4 bg-slate-950/40 border border-white/5 rounded-2xl text-left">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Temporary PIN</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xl font-mono font-bold text-brand-400 tracking-widest">
                    {createdCreds.pin}
                  </span>
                  <button
                    onClick={() => copyToClipboard(createdCreds.pin, 'pin')}
                    className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs text-left text-amber-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>
                  <strong>Security Warning:</strong> The PIN is never saved in plaintext and cannot be recovered. Make sure to copy it now. You can regenerate the credentials from the details screen if you lose them.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowCredsModal(false);
                setCreatedCreds(null);
              }}
              className="glow-btn-purple w-full py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm transition-all"
            >
              Done, Go to Event Files
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
