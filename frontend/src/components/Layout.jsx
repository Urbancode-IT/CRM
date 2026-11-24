import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Sidebar from './Sidebar';

export default function Layout() {
  const { user, logout } = useAuth();
  const { openCustomize, resolvedMode } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const night = resolvedMode === 'night';

  return (
    <div className={`flex h-screen ${night ? 'bg-slate-900' : 'bg-brand-50'}`}>
      <Sidebar user={user} logout={logout} open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={`flex items-center justify-between border-b px-4 py-3 sm:px-6 ${
            night ? 'border-white/10 bg-slate-950' : 'border-brand-100 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={`rounded-md border px-2 py-1 text-sm lg:hidden ${
                night ? 'border-white/15 text-slate-100' : 'border-brand-200 text-slate-900'
              }`}
              onClick={() => setMenuOpen(true)}
            >
              Menu
            </button>
            <div className={`text-sm font-medium ${night ? 'text-slate-100' : 'text-slate-900'}`}>
              {user?.tenant?.name || user?.instituteName || 'Workspace'}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              to="/account"
              className={`rounded-lg px-2 py-1 text-sm font-medium transition ${
                night ? 'text-slate-100 hover:bg-white/10' : 'text-slate-900 hover:bg-brand-50'
              }`}
              title="My Account"
            >
              {user?.name}
            </Link>
            <button
              type="button"
              onClick={openCustomize}
              className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                night ? 'text-slate-300 hover:bg-white/10' : 'text-slate-500 hover:bg-brand-50'
              }`}
              title="Themes"
            >
              Theme
            </button>
          </div>
        </header>
        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${night ? 'text-slate-100' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
