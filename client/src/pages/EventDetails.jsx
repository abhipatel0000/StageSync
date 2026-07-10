import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { 
  Calendar, MapPin, Clock, Trash2, Edit, RefreshCw, Download, 
  Key, QrCode, UploadCloud, FileText, Check, Copy, X, 
  Monitor, AlertTriangle, Play, FileUp, Settings, ShieldAlert
} from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function EventDetails() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [files, setFiles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // File Upload State
  const [uploads, setUploads] = useState({}); // { [tempId]: { name, progress, status } }
  const fileInputRef = useRef(null);

  // Edit Event Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [accessStartsAt, setAccessStartsAt] = useState('');
  const [accessExpiresAt, setAccessExpiresAt] = useState('');
  const [maxGuestSessions, setMaxGuestSessions] = useState(5);
  const [allowDownload, setAllowDownload] = useState(true);
  const [allowDownloadAll, setAllowDownloadAll] = useState(true);

  // Rename File Modal State
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [newDisplayName, setNewDisplayName] = useState('');

  // QR Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrToken, setQrToken] = useState('');
  const [qrExpiresAt, setQrExpiresAt] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Regenerated PIN modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [copiedPin, setCopiedPin] = useState(false);

  const [copiedCode, setCopiedCode] = useState(false);

  const fetchAllData = async () => {
    try {
      const eventRes = await client.get(`/events/${eventId}`);
      if (eventRes.data.success) {
        const ev = eventRes.data.data;
        setEvent(ev);
        setName(ev.name);
        setDescription(ev.description || '');
        setVenueName(ev.venueName || '');
        setEventDate(ev.eventDate);
        setAccessStartsAt(new Date(ev.accessStartsAt).toISOString().slice(0, 16));
        setAccessExpiresAt(new Date(ev.accessExpiresAt).toISOString().slice(0, 16));
        setMaxGuestSessions(ev.maxGuestSessions);
        setAllowDownload(ev.allowDownload);
        setAllowDownloadAll(ev.allowDownloadAll);
      }

      // Fetch files
      const filesRes = await client.get(`/events/${eventId}/files`);
      if (filesRes.data.success) {
        setFiles(filesRes.data.data.files);
      }

      // Fetch guest sessions
      const sessionsRes = await client.get(`/events/${eventId}/sessions`);
      if (sessionsRes.data.success) {
        setSessions(sessionsRes.data.data.sessions);
      }

      // Fetch downloads
      const downloadsRes = await client.get(`/events/${eventId}/downloads`);
      if (downloadsRes.data.success) {
        setDownloads(downloadsRes.data.data.logs);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch event data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [eventId]);

  // Handle Event Details Update
  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    try {
      const res = await client.patch(`/events/${eventId}`, {
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
        setShowEditModal(false);
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || 'Update failed.');
    }
  };

  // Soft Delete Event
  const handleDeleteEvent = async () => {
    if (!window.confirm('Are you sure you want to delete this event? All connected guest devices will be disconnected and files deleted.')) return;
    try {
      const res = await client.delete(`/events/${eventId}`);
      if (res.data.success) {
        navigate('/events');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to delete event.');
    }
  };

  // Regenerate Access Credentials (Code/PIN)
  const handleRegenerateCredentials = async () => {
    if (!window.confirm('Regenerating credentials will immediately DISCONNECT and logout all active venue sessions. Do you want to continue?')) return;
    try {
      const res = await client.post(`/events/${eventId}/credentials/regenerate`, { regenerateCode: true });
      if (res.data.success) {
        setNewPin(res.data.data.pin);
        setShowPinModal(true);
        fetchAllData(); // Refresh info
      }
    } catch (err) {
      console.error(err);
      setError('Failed to rotate credentials.');
    }
  };

  // Generate QR Token
  const handleRevealQr = async () => {
    try {
      setQrLoading(true);
      setShowQrModal(true);
      const res = await client.post(`/events/${eventId}/qr-tokens`);
      if (res.data.success) {
        setQrToken(res.data.data.token);
        setQrExpiresAt(new Date(res.data.data.expiresAt));
      }
    } catch (err) {
      console.error(err);
      setError('Failed to generate QR token.');
      setShowQrModal(false);
    } finally {
      setQrLoading(false);
    }
  };

  // Revoke Guest Session
  const handleRevokeSession = async (sessionPublicId) => {
    if (!window.confirm('Disconnect this device immediately?')) return;
    try {
      const res = await client.post(`/events/${eventId}/sessions/${sessionPublicId}/revoke`);
      if (res.data.success) {
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
      setError('Failed to revoke session.');
    }
  };

  // Revoke All Sessions
  const handleRevokeAllSessions = async () => {
    if (!window.confirm('Disconnect ALL currently connected venue computers immediately?')) return;
    try {
      const res = await client.post(`/events/${eventId}/sessions/revoke-all`);
      if (res.data.success) {
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
      setError('Failed to revoke sessions.');
    }
  };

  // File Upload Logic
  const handleFileDrop = (e) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles) {
      uploadFiles(Array.from(droppedFiles));
    }
  };

  const handleFileSelect = (e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      uploadFiles(Array.from(selectedFiles));
    }
  };

  const uploadFiles = async (filesToUpload) => {
    for (const file of filesToUpload) {
      const tempId = Math.random().toString(36).substr(2, 9);
      
      // Update upload UI status
      setUploads(prev => ({
        ...prev,
        [tempId]: { name: file.name, progress: 0, status: 'initiating' }
      }));

      try {
        // 1. Initiate Upload in Backend
        const initiateRes = await client.post(`/events/${eventId}/files/upload/initiate`, {
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size
        });

        if (!initiateRes.data.success) throw new Error('Initialization failed.');
        
        const { fileId, uploadUrl, method, fields, provider, storageKey } = initiateRes.data.data;

        // 2. Perform upload directly to destination (S3/R2 or Local Backend upload handler)
        setUploads(prev => ({
          ...prev,
          [tempId]: { ...prev[tempId], status: 'uploading' }
        }));

        if (provider === 'local') {
          // Local server upload
          const formData = new FormData();
          formData.append('file', file);
          
          await client.post(uploadUrl, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploads(prev => ({
                ...prev,
                [tempId]: { ...prev[tempId], progress: percentCompleted }
              }));
            }
          });
        } else {
          // R2/S3 Direct PUT upload
          const uploadClient = axios.create(); // Separate axios to avoid default authorization headers
          await uploadClient.put(uploadUrl, file, {
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploads(prev => ({
                ...prev,
                [tempId]: { ...prev[tempId], progress: percentCompleted }
              }));
            }
          });

          // 3. Mark Complete in Backend (only needed for S3/R2 direct uploads)
          await client.post(`/events/${eventId}/files/upload/complete`, { fileId });
        }

        // Success!
        setUploads(prev => ({
          ...prev,
          [tempId]: { ...prev[tempId], status: 'success', progress: 100 }
        }));

        // Remove from uploads UI list after delay, and reload file list
        setTimeout(() => {
          setUploads(prev => {
            const next = { ...prev };
            delete next[tempId];
            return next;
          });
        }, 1500);

        fetchAllData(); // Refresh file list
      } catch (err) {
        console.error(err);
        setUploads(prev => ({
          ...prev,
          [tempId]: { ...prev[tempId], status: 'failed' }
        }));
      }
    }
  };

  // File Rename
  const triggerRename = (file) => {
    setSelectedFile(file);
    setNewDisplayName(file.displayName.replace(file.extension || '', '')); // strip extension
    setShowRenameModal(true);
  };

  const handleRenameFile = async (e) => {
    e.preventDefault();
    if (!newDisplayName || !selectedFile) return;

    try {
      const res = await client.patch(`/events/${eventId}/files/${selectedFile.publicId}`, {
        displayName: newDisplayName
      });
      if (res.data.success) {
        setShowRenameModal(false);
        setSelectedFile(null);
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
      setError('Failed to rename file.');
    }
  };

  // Delete File
  const handleDeleteFile = async (filePublicId) => {
    if (!window.confirm('Delete this file? It will be deleted permanently from the storage server.')) return;
    try {
      const res = await client.delete(`/events/${eventId}/files/${filePublicId}`);
      if (res.data.success) {
        fetchAllData();
      }
    } catch (err) {
      console.error(err);
      setError('Failed to delete file.');
    }
  };

  // Trigger Organizer File Download
  const handleDownloadFile = async (filePublicId) => {
    try {
      const res = await client.get(`/events/${eventId}/files/${filePublicId}/download`);
      if (res.data.success) {
        const url = res.data.data.downloadUrl;
        
        // Open download in a new window or trigger download via hidden anchor
        const link = document.createElement('a');
        link.href = url.startsWith('/') ? `${client.defaults.baseURL.replace('/api/v1', '')}${url}` : url;
        link.setAttribute('download', '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to download file.');
    }
  };

  // Copy Event Code
  const copyEventCode = () => {
    navigator.clipboard.writeText(event.eventCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyNewPin = () => {
    navigator.clipboard.writeText(newPin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm max-w-md mx-auto text-center">
        Event not found. <Link to="/events" className="underline">Back to list</Link>
      </div>
    );
  }

  // Construct QR URL
  const qrBaseUrl = window.location.origin + `/guest/qr-login?token=${qrToken}`;
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrBaseUrl)}`;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      {/* Breadcrumbs & Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1.5">
            <Link to="/events" className="hover:text-brand-400 transition-colors">Events</Link>
            <span>/</span>
            <span className="text-slate-400 truncate max-w-[150px] sm:max-w-xs">{event.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{event.name}</h1>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
              event.status === 'ACTIVE' 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : event.status === 'UPCOMING'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse'
                : 'bg-slate-500/10 text-slate-400 border border-white/5'
            }`}>
              {event.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 border border-white/5 hover:border-white/10 text-slate-300 hover:text-white transition-all"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit Settings
          </button>
          <button
            onClick={handleDeleteEvent}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Workspace
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Main Grid: Left column (details + files), Right column (creds + sessions) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side (Files & Upload Manager) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* File Upload Zone */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-brand-400" />
              Upload Event Files
            </h2>
            
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 hover:border-brand-500/50 hover:bg-brand-500/5 rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                multiple 
                className="hidden" 
              />
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                <FileUp className="w-6 h-6 text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Drag & drop files here, or click to browse</p>
                <p className="text-xs text-slate-500 mt-1">Supports PowerPoint, PDFs, Videos (MP4/MOV), Audio, and ZIP archives up to 2GB.</p>
              </div>
            </div>

            {/* Active Uploads list */}
            {Object.keys(uploads).length > 0 && (
              <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
                <p className="text-xs font-semibold text-slate-400">Uploading Assets...</p>
                {Object.entries(uploads).map(([tempId, upload]) => (
                  <div key={tempId} className="p-3 bg-slate-950/40 border border-white/5 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-300 truncate max-w-[70%]">{upload.name}</span>
                      <span className={`capitalize font-semibold ${
                        upload.status === 'success' 
                          ? 'text-emerald-400' 
                          : upload.status === 'failed'
                          ? 'text-rose-400'
                          : 'text-brand-400'
                      }`}>
                        {upload.status === 'uploading' ? `${upload.progress}%` : upload.status}
                      </span>
                    </div>
                    {upload.status !== 'failed' && (
                      <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-brand-500 rounded-full transition-all duration-300"
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Files List */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-400" />
                Workspace Files ({files.length})
              </h2>
              <span className="text-xs text-slate-500">Prepared items for presentation</span>
            </div>

            {files.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                No files uploaded to this event workspace yet. Upload some files above.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {files.map((file) => (
                  <div key={file.publicId} className="py-4 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-brand-300" />
                      </div>
                      <div className="overflow-hidden">
                        <p 
                          className="text-sm font-semibold text-slate-200 truncate cursor-pointer hover:text-brand-400"
                          title={file.displayName}
                          onClick={() => handleDownloadFile(file.publicId)}
                        >
                          {file.displayName}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {formatBytes(file.sizeBytes)} &bull; {formatDate(file.uploadedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => triggerRename(file)}
                        className="p-2 bg-slate-900 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
                        title="Rename file display name"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDownloadFile(file.publicId)}
                        className="p-2 bg-slate-900 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
                        title="Download file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.publicId)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/10 hover:border-rose-500/20 text-rose-400 rounded-lg transition-colors"
                        title="Delete file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Side (Credentials & Connected Sessions) */}
        <div className="space-y-8">
          
          {/* Credentials Card */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl pointer-events-none"></div>

            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-brand-400" />
              Venue Credentials
            </h2>

            <div className="space-y-4">
              {/* Event Code */}
              <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl">
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Event Code</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-lg font-mono font-bold text-slate-200 tracking-wider">
                    {event.eventCode}
                  </span>
                  <button
                    onClick={copyEventCode}
                    className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-md transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* PIN Info */}
              <div className="p-3.5 bg-slate-950/30 border border-dashed border-white/10 rounded-xl text-center text-xs text-slate-400 space-y-1.5">
                <p>Access requires the 6-digit verification PIN.</p>
                <p className="text-[10px] text-slate-500">PIN has been securely hashed in our database.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleRevealQr}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 text-xs font-semibold rounded-lg transition-all"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Reveal QR Code
                </button>
                <button
                  onClick={handleRegenerateCredentials}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Rotate PIN
                </button>
              </div>
            </div>
          </div>

          {/* Active Guest Sessions */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col h-[300px]">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Monitor className="w-4 h-4 text-emerald-400 animate-pulse" />
                Active Venue Devices ({sessions.filter(s => s.status === 'ACTIVE').length})
              </h2>
              {sessions.filter(s => s.status === 'ACTIVE').length > 0 && (
                <button 
                  onClick={handleRevokeAllSessions}
                  className="text-[10px] font-bold text-rose-400 hover:underline"
                >
                  Revoke All
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {sessions.filter(s => s.status === 'ACTIVE').length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs text-center px-4">
                  No active venue computers connected. Enter the Code & PIN on the shared computer to authenticate.
                </div>
              ) : (
                sessions.filter(s => s.status === 'ACTIVE').map((session) => (
                  <div key={session.publicId} className="p-3 bg-slate-950/40 border border-white/5 rounded-xl flex items-center justify-between text-xs">
                    <div className="overflow-hidden mr-2">
                      <p className="font-semibold text-slate-200 truncate">{session.deviceName}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{session.ipAddress}</p>
                    </div>
                    <button
                      onClick={() => handleRevokeSession(session.publicId)}
                      className="px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-[10px] font-bold shrink-0 transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Download Logs */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col h-[280px]">
            <div className="border-b border-white/5 pb-4 mb-4 flex justify-between items-center">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Download className="w-4 h-4 text-brand-400" />
                Workspace Download Logs
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {downloads.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No assets downloaded yet.
                </div>
              ) : (
                downloads.map((log) => (
                  <div key={log.id} className="p-2.5 bg-slate-950/40 border border-white/5 rounded-xl text-[10px] flex items-center justify-between">
                    <div className="truncate max-w-[70%]">
                      <p className="font-semibold text-slate-300 truncate">{log.fileName}</p>
                      <p className="text-slate-500 mt-0.5 truncate">Device: {log.deviceName}</p>
                    </div>
                    <span className="text-[9px] text-slate-500 text-right shrink-0">{formatDate(log.createdAt).split(',')[0]}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* QR Access Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-sm bg-darkbg-900 border border-white/10 rounded-3xl p-6 text-center relative">
            <button
              onClick={() => {
                setShowQrModal(false);
                setQrToken('');
              }}
              className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold mb-2 text-slate-100">Scan QR to Access</h3>
            <p className="text-xs text-slate-400 mb-6">
              Point the venue computer's camera at this code to automatically authenticate the device.
            </p>

            {qrLoading ? (
              <div className="w-[250px] h-[250px] mx-auto flex items-center justify-center bg-slate-950/20 border border-white/5 rounded-2xl">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              qrToken && (
                <div className="bg-white p-4 rounded-2xl inline-block shadow-xl shadow-brand-500/5 mb-4 border border-slate-200">
                  <img 
                    src={qrImageSrc} 
                    alt="QR Authentication Link" 
                    className="w-[200px] h-[200px]"
                  />
                </div>
              )
            )}

            <div className="text-[10px] text-slate-500 mt-2 space-y-1">
              <p>Generates a secure, single-use login token.</p>
              <p className="text-brand-400 font-medium">Expires in 5 minutes.</p>
            </div>
          </div>
        </div>
      )}

      {/* New PIN Reveal Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-sm bg-darkbg-900 border border-white/10 rounded-2xl p-6 text-center relative">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-emerald-400">
              <Key className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold mb-2 text-slate-100">Credentials Rotated</h3>
            <p className="text-xs text-slate-400 mb-6">
              All active sessions were terminated. Here is your new 6-digit verification PIN:
            </p>

            <div className="p-4 bg-slate-950/60 border border-white/5 rounded-xl flex items-center justify-between mb-6">
              <span className="text-2xl font-mono font-bold tracking-widest text-brand-400 mx-auto pl-6">
                {newPin}
              </span>
              <button
                onClick={copyNewPin}
                className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={() => {
                setShowPinModal(false);
                setNewPin('');
              }}
              className="glow-btn-purple w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Edit Event Settings Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-darkbg-900 border border-white/10 rounded-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-bold mb-6 text-slate-100">Edit Event Settings</h2>

            <form onSubmit={handleUpdateEvent} className="space-y-4">
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
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 px-4 bg-slate-900 border border-white/10 text-slate-300 font-semibold rounded-xl text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="glow-btn-purple flex-1 py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {showRenameModal && selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-darkbg-900 border border-white/10 rounded-2xl p-6 relative">
            <button
              onClick={() => {
                setShowRenameModal(false);
                setSelectedFile(null);
              }}
              className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold mb-4 text-slate-100">Rename File</h3>

            <form onSubmit={handleRenameFile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Display Filename
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    required
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    className="glass-input flex-1 px-4 py-2.5 rounded-xl text-slate-200 text-sm"
                  />
                  {selectedFile.extension && (
                    <span className="text-sm text-slate-400 font-semibold bg-slate-900 border border-white/5 px-3 py-2.5 rounded-xl">
                      {selectedFile.extension}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/5 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowRenameModal(false);
                    setSelectedFile(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-900 border border-white/10 text-slate-300 font-semibold rounded-xl text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="glow-btn-purple flex-1 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm transition-all"
                >
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
