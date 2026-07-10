import React, { useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Calendar, Shield, Settings, LogOut, User, FolderOpen } from 'lucide-react';

export default function OrganizerLayout() {
  const { user, loading, logoutOrganizer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-darkbg-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return null;

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'My Events', path: '/events', icon: Calendar },
    { name: 'Account Settings', path: '/settings', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-darkbg-950 text-slate-100 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 glass-panel border-r border-white/5 flex flex-col justify-between z-30 sticky top-0 h-screen">
        <div>
          {/* Logo */}
          <div className="px-6 py-6 border-b border-white/5">
            <Link to="/dashboard" className="flex items-center gap-2 text-lg font-bold tracking-wider text-slate-100 uppercase">
              <span className="bg-gradient-to-r from-violet-500 to-indigo-500 text-transparent bg-clip-text font-extrabold">Stage</span>
              <span className="text-violet-400 font-semibold">Sync</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 px-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/15'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl bg-slate-900/50 border border-white/5">
            <div className="w-8 h-8 rounded-full bg-brand-500/25 border border-brand-500/35 flex items-center justify-center text-brand-300 font-bold">
              {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">{user.fullName}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logoutOrganizer();
              navigate('/login');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20"
          >
            <LogOut className="w-5 h-5 text-rose-400" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 p-8">
          <Outlet />
        </main>
        <footer className="py-6 px-8 border-t border-white/5 text-xs text-slate-500 text-center bg-darkbg-900/50">
          &copy; {new Date().getFullYear()} StageSync. Administrative Dashboard.
        </footer>
      </div>
    </div>
  );
}
