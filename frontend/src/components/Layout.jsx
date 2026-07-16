import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/students', label: 'Students' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/payments', label: 'Payments' },
  { to: '/tasks', label: 'Tasks' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white p-4">
        <div className="mb-8 px-2 text-xl font-bold text-brand-700">Tuition CRM</div>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="text-sm text-slate-500">Tuition Student Management</div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">{user?.name}</span>
            <button
              onClick={logout}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
