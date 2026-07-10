import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { User, Lock, Save, Key, AlertCircle, CheckCircle } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  
  // Profile settings state
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password settings state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securitySuccess, setSecuritySuccess] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');
    
    if (!fullName) {
      setProfileError('Full name cannot be empty.');
      return;
    }

    try {
      setProfileLoading(true);
      const res = await client.patch('/auth/profile', { fullName });
      if (res.data.success) {
        setProfileSuccess('Profile updated successfully.');
      }
    } catch (err) {
      console.error(err);
      setProfileError(err.response?.data?.error?.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setSecuritySuccess('');
    setSecurityError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setSecurityError('All password fields are required.');
      return;
    }

    if (newPassword.length < 8) {
      setSecurityError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityError('New passwords do not match.');
      return;
    }

    try {
      setSecurityLoading(true);
      const res = await client.patch('/auth/profile', {
        currentPassword,
        newPassword
      });
      if (res.data.success) {
        setSecuritySuccess('Password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      console.error(err);
      setSecurityError(err.response?.data?.error?.message || 'Failed to update password.');
    } finally {
      setSecurityLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Account Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure your master organizer profile and security settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Profile Info */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-brand-400" />
              General Profile
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Your organizer display parameters.</p>
          </div>

          {profileSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-emerald-400">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{profileSuccess}</p>
            </div>
          )}

          {profileError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{profileError}</p>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="glass-input w-full px-4 py-2.5 rounded-xl text-slate-200 text-sm"
                required
                disabled={profileLoading}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                className="glass-input w-full px-4 py-2.5 rounded-xl text-slate-500 text-sm cursor-not-allowed bg-slate-950/20"
                disabled
              />
              <p className="text-[10px] text-slate-600 mt-1">Email cannot be modified once registered.</p>
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              className="glow-btn-purple flex items-center justify-center gap-2 py-2.5 px-5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {profileLoading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Security / Password */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Key className="w-5 h-5 text-brand-400" />
              Security Settings
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Rotate your account password.</p>
          </div>

          {securitySuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-emerald-400">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{securitySuccess}</p>
            </div>
          )}

          {securityError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{securityError}</p>
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="glass-input w-full px-4 py-2.5 rounded-xl text-slate-200 text-sm"
                required
                disabled={securityLoading}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="glass-input w-full px-4 py-2.5 rounded-xl text-slate-200 text-sm"
                required
                disabled={securityLoading}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="glass-input w-full px-4 py-2.5 rounded-xl text-slate-200 text-sm"
                required
                disabled={securityLoading}
              />
            </div>

            <button
              type="submit"
              disabled={securityLoading}
              className="glow-btn-purple flex items-center justify-center gap-2 py-2.5 px-5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {securityLoading ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
