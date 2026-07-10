import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { FileText, Download, Clock, HardDrive, RefreshCw, AlertCircle } from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function GuestWorkspace() {
  const { guestEvent, guestSession, logoutGuest } = useAuth();
  const navigate = useNavigate();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState('');

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await client.get('/guest/files');
      if (res.data.success) {
        setFiles(res.data.data.files);
      }
    } catch (err) {
      console.error(err);
      const status = err.response?.status;
      const code = err.response?.data?.error?.code;
      if (status === 401 && (code === 'SESSION_REVOKED' || code === 'AUTHENTICATION_REQUIRED')) {
        // Session was explicitly revoked by the organizer — force logout
        await logoutGuest();
        navigate('/guest');
      } else if (status === 403 && (code === 'EVENT_EXPIRED' || code === 'SESSION_EXPIRED')) {
        // Event expired — force logout
        await logoutGuest();
        navigate('/guest');
      } else {
        // Network error or transient failure — show error, do NOT log out
        setError('Failed to load event files. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();

    // 1. Setup countdown timer
    const interval = setInterval(() => {
      if (!guestSession?.expiresAt) return;
      
      const now = new Date().getTime();
      const expiry = new Date(guestSession.expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft('Expired');
        logoutGuest().then(() => navigate('/guest'));
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        let displayStr = '';
        if (hours > 0) displayStr += `${hours}h `;
        displayStr += `${minutes}m ${seconds}s`;
        setTimeLeft(displayStr);
      }
    }, 1000);

    // 2. Setup periodic folder sync (poll every 30 seconds for newly uploaded presenter files!)
    const syncInterval = setInterval(() => {
      fetchFiles();
    }, 30000);

    return () => {
      clearInterval(interval);
      clearInterval(syncInterval);
    };
  }, [guestSession, navigate]);

  const handleDownload = async (filePublicId, originalName) => {
    try {
      setDownloadingFileId(filePublicId);
      const res = await client.get(`/guest/files/${filePublicId}/download`);
      if (res.data.success) {
        const downloadUrl = res.data.data.downloadUrl;
        
        // Open download in window or hidden link redirection
        const link = document.createElement('a');
        link.href = downloadUrl.startsWith('/') ? `${client.defaults.baseURL.replace('/api/v1', '')}${downloadUrl}` : downloadUrl;
        link.setAttribute('download', originalName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error(err);
      const status = err.response?.status;
      const code = err.response?.data?.error?.code;
      if (status === 401 && (code === 'SESSION_REVOKED' || code === 'AUTHENTICATION_REQUIRED')) {
        await logoutGuest();
        navigate('/guest');
      } else {
        alert(err.response?.data?.error?.message || 'Failed to trigger file download.');
      }
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleDownloadAll = async () => {
    try {
      setDownloadingFileId('zip');
      const downloadUrl = `${client.defaults.baseURL}/guest/files/download-all`;
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${guestEvent?.name || 'event'}_assets.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Failed to package files.');
    } finally {
      setDownloadingFileId(null);
    }
  };

  if (loading && files.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto w-full">
      {/* Session Expire Countdown Alert */}
      <div className="glass-panel p-5 rounded-2xl border border-emerald-500/10 bg-emerald-950/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-slate-100">Authenticated Venue Session</h4>
            <p className="text-xs text-slate-400 mt-0.5">Your temporary download access window is active.</p>
          </div>
        </div>
        <div className="text-left sm:text-right shrink-0">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Session Expires In</p>
          <p className="text-lg font-mono font-bold text-emerald-400 mt-0.5">{timeLeft || 'calculating...'}</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Files Panel */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
          <div>
            <h2 className="font-bold text-lg text-slate-100">Event Asset Package</h2>
            <p className="text-xs text-slate-400 mt-1">Download required presentation materials below.</p>
          </div>
          <div className="flex items-center gap-3">
            {guestEvent?.allowDownloadAll && files.length > 1 && (
              <button 
                onClick={handleDownloadAll}
                disabled={downloadingFileId !== null}
                className="flex items-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/10 disabled:opacity-50"
              >
                {downloadingFileId === 'zip' ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Download All (.ZIP)
              </button>
            )}
            <button 
              onClick={fetchFiles}
              className="p-2.5 bg-slate-900 border border-white/5 hover:border-white/10 text-slate-300 hover:text-white rounded-lg transition-colors"
              title="Refresh files"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm space-y-2">
            <HardDrive className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-400">Workspace is empty</p>
            <p className="text-xs max-w-xs mx-auto">The event organizer hasn't uploaded files to this session yet. Uploads will synchronize automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <div 
                key={file.publicId} 
                className="p-4 bg-slate-950/30 hover:bg-slate-950/50 border border-white/5 hover:border-brand-500/20 rounded-2xl flex items-center justify-between gap-4 transition-all group"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0 text-brand-300">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-slate-200 truncate group-hover:text-brand-300 transition-colors">
                      {file.displayName}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Size: {formatBytes(file.sizeBytes)}
                    </p>
                  </div>
                </div>

                <button
                  disabled={downloadingFileId !== null}
                  onClick={() => handleDownload(file.publicId, file.originalName)}
                  className="flex items-center gap-2 py-2 px-4 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-600/10 disabled:opacity-50"
                >
                  {downloadingFileId === file.publicId ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
