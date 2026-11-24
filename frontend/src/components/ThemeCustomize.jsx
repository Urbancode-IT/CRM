import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { BRAND_NAME } from '../constants/brand';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 14.3A8.5 8.5 0 0 1 9.7 3 7.5 7.5 0 1 0 21 14.3z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="4" width="18" height="13" rx="1.5" />
      <path strokeLinecap="round" d="M8 21h8M12 17v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4.5 4.5L19 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function ModeIcon({ id }) {
  if (id === 'day') return <SunIcon />;
  if (id === 'night') return <MoonIcon />;
  return <MonitorIcon />;
}

function trialDaysLeft(user) {
  const end = user?.subscription?.currentPeriodEnd || user?.trialEndsAt;
  if (!end) return 14;
  const ms = new Date(end).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function ThemeCustomize() {
  const { user, logout } = useAuth();
  const {
    customizeOpen,
    closeCustomize,
    themes,
    themeId,
    setThemeId,
    colors,
    modeId,
    modes,
    setModeId,
    appearanceId,
    appearances,
    setAppearanceId,
    fontSizeId,
    fontSizes,
    setFontSizeId,
  } = useTheme();

  useEffect(() => {
    if (!customizeOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeCustomize();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [customizeOpen, closeCustomize]);

  if (!customizeOpen) return null;

  const initials = (user?.name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  const planName = user?.subscription?.plan?.name || user?.planName || 'Trial';
  const planStatus = user?.subscription?.status || 'trialing';
  const isTrial = planStatus === 'trialing';
  const days = trialDaysLeft(user);
  const workspace = user?.tenant?.name || user?.instituteName || 'Workspace';
  const role = user?.role || user?.membership?.role || 'User';
  const email = user?.email || '';
  const selectedTheme = themes.find((t) => t.id === themeId);

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <button
        type="button"
        aria-label="Close account panel"
        className="absolute inset-0 bg-slate-950/30"
        onClick={closeCustomize}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Account and appearance"
        className="relative flex h-full w-full max-w-[380px] flex-col border-l border-slate-200 bg-white"
      >
        {/* Profile */}
        <header className="border-b border-slate-200 px-5 pb-5 pt-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Account
            </p>
            <button
              type="button"
              onClick={closeCustomize}
              className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex items-center gap-3.5">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: colors[600] }}
            >
              {initials || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-semibold tracking-tight text-slate-900">
                {user?.name || 'Account'}
              </p>
              {email ? (
                <p className="mt-0.5 truncate text-xs text-slate-500">{email}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {workspace}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600">
                  {role}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* Plan */}
          <section className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Subscription
                </p>
                <p className="mt-1.5 font-display text-lg font-semibold tracking-tight text-slate-900">
                  {planName}
                </p>
                {isTrial ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Trial ends in <span className="font-semibold text-slate-800">{days} days</span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs capitalize text-slate-500">{planStatus}</p>
                )}
              </div>
              <Link
                to="/app/billing"
                onClick={closeCustomize}
                className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: colors[600] }}
              >
                Upgrade
              </Link>
            </div>
            <Link
              to="/app/billing"
              onClick={closeCustomize}
              className="mt-3 inline-block text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            >
              Compare plans
            </Link>
          </section>

          {/* Shortcuts */}
          <section className="border-b border-slate-100 px-5 py-4">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Quick links
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: '/app', label: 'Dashboard' },
                { to: '/app/modules', label: 'Modules' },
                { to: '/account', label: 'My account' },
                { to: '/app/billing', label: 'Billing' },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={closeCustomize}
                  className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </section>

          {/* Appearance */}
          <section className="border-b border-slate-100 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Appearance
            </p>

            <p className="mb-2 mt-4 text-xs font-medium text-slate-600">Display mode</p>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {modes.map((m) => {
                const active = m.id === modeId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModeId(m.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <ModeIcon id={m.id} />
                    {m.name}
                  </button>
                );
              })}
            </div>

            <p className="mb-2 mt-4 text-xs font-medium text-slate-600">Sidebar style</p>
            <div className="flex gap-2">
              {appearances.map((a) => {
                const active = appearanceId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAppearanceId(a.id)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>

            <p className="mb-2 mt-4 text-xs font-medium text-slate-600">
              Brand colour
              {selectedTheme ? (
                <span className="ml-1.5 font-normal text-slate-400">· {selectedTheme.name}</span>
              ) : null}
            </p>
            <div className="grid grid-cols-7 gap-2">
              {themes.map((t) => {
                const selected = t.id === themeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    title={t.name}
                    onClick={() => setThemeId(t.id)}
                    className="relative flex h-8 w-8 items-center justify-center rounded-md transition hover:opacity-90"
                    style={{
                      backgroundColor: t.swatch,
                      boxShadow: selected
                        ? `0 0 0 2px #fff, 0 0 0 3.5px ${t.swatch}`
                        : 'inset 0 0 0 1px rgba(15,23,42,0.12)',
                    }}
                    aria-label={t.name}
                    aria-pressed={selected}
                  >
                    {selected ? (
                      <span className="text-white">
                        <CheckIcon />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <p className="mb-2 mt-4 text-xs font-medium text-slate-600">Text size</p>
            <div className="grid grid-cols-4 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {fontSizes.map((f) => {
                const active = f.id === fontSizeId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    title={f.description}
                    onClick={() => setFontSizeId(f.id)}
                    className={`rounded-md px-1.5 py-2 text-[11px] font-medium transition ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {f.name === 'Extra large' ? 'XL' : f.name}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Help / session */}
          <section className="px-5 py-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Session
            </p>
            <div className="space-y-1">
              <Link
                to="/account"
                onClick={closeCustomize}
                className="flex items-center justify-between rounded-lg px-2.5 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <span>Profile & security</span>
                <span className="text-slate-400">→</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  closeCustomize();
                  logout();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2.5 text-sm text-rose-600 transition hover:bg-rose-50"
              >
                <span>Sign out</span>
                <span className="text-rose-400">→</span>
              </button>
            </div>
          </section>
        </div>

        <footer className="border-t border-slate-100 px-5 py-3">
          <p className="text-center text-[11px] text-slate-400">
            {BRAND_NAME} · preferences saved on this device · Esc to close
          </p>
        </footer>
      </aside>
    </div>
  );
}
