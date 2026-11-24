import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { BRAND_NAME } from '../constants/brand';
import Modal from '../components/Modal';

const SECTIONS = [
  {
    id: 'profile',
    label: 'Profile',
    icon: 'user',
    children: [
      { id: 'personal', label: 'Personal Information' },
      { id: 'email', label: 'Email Address' },
      { id: 'mobile', label: 'Mobile Numbers' },
    ],
  },
  { id: 'security', label: 'Security', icon: 'shield' },
  { id: 'mfa', label: 'Multi-Factor Authentication', icon: 'mfa' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
  { id: 'sessions', label: 'Sessions', icon: 'calendar' },
  { id: 'groups', label: 'Groups', icon: 'groups' },
  { id: 'privacy', label: 'Privacy', icon: 'lock' },
  { id: 'compliance', label: 'Compliance', icon: 'badge' },
];

const GENDER_OPTIONS = ["I'd prefer not to say", 'Female', 'Male', 'Non-binary', 'Other'];
const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'ta-IN', label: 'Tamil' },
  { value: 'hi-IN', label: 'Hindi' },
];
const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: '(GMT +05:30) India Standard Time (Asia/Kolkata)' },
  { value: 'Asia/Dubai', label: '(GMT +04:00) Gulf Standard Time (Asia/Dubai)' },
  { value: 'UTC', label: '(GMT +00:00) Coordinated Universal Time' },
];

function NavIcon({ type, className = 'h-4 w-4' }) {
  const props = {
    viewBox: '0 0 24 24',
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    'aria-hidden': true,
  };
  if (type === 'user') {
    return (
      <svg {...props}>
        <circle cx="12" cy="8" r="3.5" />
        <path strokeLinecap="round" d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19" />
      </svg>
    );
  }
  if (type === 'shield') {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />
      </svg>
    );
  }
  if (type === 'mfa') {
    return (
      <svg {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
      </svg>
    );
  }
  if (type === 'gear') {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="3" />
        <path strokeLinecap="round" d="M12 3v2M12 19v2M4.2 6.5l1.8 1M18 16.5l1.8 1M3 12h2M19 12h2M4.2 17.5l1.8-1M18 7.5l1.8-1" />
      </svg>
    );
  }
  if (type === 'calendar') {
    return (
      <svg {...props}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    );
  }
  if (type === 'groups') {
    return (
      <svg {...props}>
        <circle cx="9" cy="8" r="3" />
        <path strokeLinecap="round" d="M2 19c.8-2.8 2.8-4 5-4s4.2 1.2 5 4" />
        <circle cx="17" cy="9" r="2.5" />
        <path strokeLinecap="round" d="M14.5 19c.5-2 1.8-3 3.5-3s2.7.8 3.2 2.5" />
      </svg>
    );
  }
  if (type === 'lock') {
    return (
      <svg {...props}>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path strokeLinecap="round" d="M8 11V8a4 4 0 1 1 8 0v3" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path strokeLinecap="round" d="M8 12h8M12 8v8" />
    </svg>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value || '—'}</p>
    </div>
  );
}

function Card({ title, children, action }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {action}
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3">
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-slate-500">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300"
      />
    </label>
  );
}

function languageLabel(code) {
  return LANGUAGE_OPTIONS.find((l) => l.value === code)?.label || code || 'English';
}

function timezoneLabel(code) {
  return TIMEZONE_OPTIONS.find((t) => t.value === code)?.label || code || '—';
}

function formatWhen(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function AccountPage() {
  const { user, updateProfile, refreshUser, logout } = useAuth();
  const { colors, openCustomize } = useTheme();
  const [params, setParams] = useSearchParams();
  const section = params.get('section') || 'personal';
  const [profileOpen, setProfileOpen] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [mobileValue, setMobileValue] = useState('');
  const [settingsForm, setSettingsForm] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [members, setMembers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [backupCodes, setBackupCodes] = useState([]);
  const [loadingSection, setLoadingSection] = useState(false);
  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');

  const accent = colors[600] || '#2563eb';
  const initials = useMemo(
    () =>
      (user?.name || 'U')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join(''),
    [user?.name]
  );

  useEffect(() => {
    if (!user) return;
    setSecondaryEmail(user.secondaryEmail || '');
    setMobileValue(user.mobile || '');
    setSettingsForm({
      loginAlerts: user.loginAlerts !== false,
      emailMarketing: Boolean(user.emailMarketing),
      shareAnalytics: user.shareAnalytics !== false,
      language: user.language || 'en-US',
      timeZone: user.timeZone || 'Asia/Kolkata',
    });
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    async function load() {
      setLoadingSection(true);
      setError('');
      try {
        if (section === 'sessions') {
          const res = await api.get('/auth/sessions');
          if (!cancelled) setSessions(res.data.sessions || []);
        } else if (section === 'groups') {
          const res = await api.get('/auth/members');
          if (!cancelled) setMembers(res.data.members || []);
        } else if (section === 'compliance') {
          const res = await api.get('/auth/compliance');
          if (!cancelled) setLogs(res.data.logs || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load section');
      } finally {
        if (!cancelled) setLoadingSection(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [section, user]);

  if (!user) return <Navigate to="/login" replace />;

  function openSection(id) {
    setParams({ section: id });
    setMessage('');
    setError('');
    setBackupCodes([]);
    if (['personal', 'email', 'mobile'].includes(id)) setProfileOpen(true);
  }

  function startEdit() {
    setError('');
    setMessage('');
    setForm({
      name: user.name || '',
      displayName: user.displayName || user.name || '',
      gender: user.gender || "I'd prefer not to say",
      country: user.country || 'India',
      state: user.state || '',
      language: user.language || 'en-US',
      timeZone: user.timeZone || 'Asia/Kolkata',
      mobile: user.mobile || '',
    });
    setEditing(true);
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateProfile(form);
      setMessage('Profile updated');
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  async function saveMobile(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put('/auth/settings', { mobile: mobileValue });
      await refreshUser();
      setMessage('Mobile number saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save mobile');
    } finally {
      setSaving(false);
    }
  }

  async function saveSecondaryEmail(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put('/auth/settings', { secondaryEmail });
      await refreshUser();
      setMessage('Recovery email saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save email');
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirm) {
      setError('New password and confirm password must match');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.put('/auth/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' });
      setMessage(res.data.message || 'Password updated');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change password');
    } finally {
      setSaving(false);
    }
  }

  async function startMfaSetup() {
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/auth/mfa/setup');
      setMfaSetup(res.data);
      setMessage('Scan the secret in Google Authenticator / Authy, then enter a code to enable.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start MFA setup');
    } finally {
      setSaving(false);
    }
  }

  async function toggleMfa(enabled) {
    setSaving(true);
    setError('');
    try {
      const res = await api.put('/auth/mfa', { enabled, code: mfaCode });
      await refreshUser();
      setBackupCodes(res.data.backupCodes || []);
      // Secret is only from setup; never re-sent after MFA is enabled.
      if (!enabled) setMfaSetup(null);
      setMfaCode('');
      setMessage(res.data.message || (enabled ? 'MFA enabled' : 'MFA disabled'));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update MFA');
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/auth/members/invite', { email: inviteEmail, role: inviteRole });
      setMessage(res.data.acceptUrl ? `Invite sent. Link: ${res.data.acceptUrl}` : 'Invite sent');
      setInviteEmail('');
      const list = await api.get('/auth/members');
      setMembers(list.data.members || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Invite failed');
    } finally {
      setSaving(false);
    }
  }

  async function revokeMember(id) {
    setSaving(true);
    try {
      await api.delete(`/auth/members/${id}`);
      const list = await api.get('/auth/members');
      setMembers(list.data.members || []);
      setMessage('Member removed');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not remove member');
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put('/auth/settings', settingsForm);
      await refreshUser();
      setMessage('Settings saved');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  async function revokeSession(id) {
    setSaving(true);
    setError('');
    try {
      await api.delete(`/auth/sessions/${id}`);
      const res = await api.get('/auth/sessions');
      setSessions(res.data.sessions || []);
      setMessage('Session signed out');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not revoke session');
    } finally {
      setSaving(false);
    }
  }

  async function revokeOthers() {
    setSaving(true);
    setError('');
    try {
      const res = await api.delete('/auth/sessions');
      const list = await api.get('/auth/sessions');
      setSessions(list.data.sessions || []);
      setMessage(`Signed out ${res.data.revoked || 0} other session(s)`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not sign out other sessions');
    } finally {
      setSaving(false);
    }
  }

  async function exportData() {
    setSaving(true);
    setError('');
    try {
      const res = await api.get('/auth/privacy/export');
      const blob = new Blob([JSON.stringify(res.data.export, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-account-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Privacy export downloaded');
    } catch (err) {
      setError(err.response?.data?.message || 'Export failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eef1f6] text-slate-800">
      <header className="border-b border-slate-200 bg-white" style={{ borderTop: `3px solid ${colors[700]}` }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md text-white"
              style={{ backgroundColor: accent }}
            >
              <NavIcon type="shield" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Accounts</p>
              <p className="text-[11px] text-slate-500">{BRAND_NAME}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Back to app
            </Link>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              {initials}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row">
        <aside className="w-full shrink-0 overflow-hidden rounded-2xl bg-[#1b2430] text-slate-200 lg:w-64">
          <nav className="space-y-0.5 p-2">
            {SECTIONS.map((item) => {
              const activeParent =
                item.id === 'profile'
                  ? ['personal', 'email', 'mobile'].includes(section)
                  : section === item.id;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (item.children) {
                        setProfileOpen(true);
                        openSection(item.children[0].id);
                      } else {
                        openSection(item.id);
                      }
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                      activeParent ? 'bg-white/10 font-semibold text-white' : 'text-slate-300 hover:bg-white/5'
                    }`}
                    style={activeParent ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
                  >
                    <span style={{ color: activeParent ? accent : undefined }}>
                      <NavIcon type={item.icon} />
                    </span>
                    {item.label}
                  </button>
                  {item.children && (profileOpen || activeParent) ? (
                    <div className="mb-1 ml-4 space-y-0.5 border-l border-white/10 py-1 pl-3">
                      {item.children.map((child) => {
                        const active = section === child.id;
                        return (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => openSection(child.id)}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
                              active ? 'font-semibold text-white' : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: active ? accent : 'transparent' }}
                            />
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-3">
            <button
              type="button"
              onClick={logout}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-white/5"
            >
              Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          {error ? <div className="rounded-xl bg-[#fdeaea] px-4 py-3 text-sm text-[#d03b3b]">{error}</div> : null}
          {message ? <div className="rounded-xl bg-[#eaf7ea] px-4 py-3 text-sm text-[#0ca30c]">{message}</div> : null}

          {section === 'personal' ? (
            <Card
              title="Profile"
              action={
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: accent }}
                >
                  Edit
                </button>
              }
            >
              <div className="mb-8 flex items-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold text-white"
                  style={{ backgroundColor: accent }}
                >
                  {initials}
                </div>
                <div>
                  <p className="text-xl font-semibold text-slate-900">{user.name}</p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Full Name" value={user.name} />
                <Field label="Display Name" value={user.displayName || user.name} />
                <Field label="Gender" value={user.gender || "I'd prefer not to say"} />
                <Field label="Country/Region" value={user.country || 'India'} />
                <Field label="State" value={user.state || '—'} />
                <Field label="Language" value={languageLabel(user.language)} />
                <Field label="Time zone" value={timezoneLabel(user.timeZone)} />
              </div>
            </Card>
          ) : null}

          {section === 'email' ? (
            <Card title="My Email Addresses">
              <p className="mb-5 max-w-2xl text-sm text-slate-500">
                Manage emails used for sign-in and recovery.
              </p>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Primary · {user.authProvider === 'google' ? 'Google sign-in' : 'Password sign-in'}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white"
                    style={{ backgroundColor: accent }}
                  >
                    Verified
                  </span>
                </div>
              </div>
              <form onSubmit={saveSecondaryEmail} className="mt-4 rounded-xl border border-slate-200 p-4">
                <label className="block text-xs font-medium text-slate-600">
                  Recovery email
                  <input
                    type="email"
                    value={secondaryEmail}
                    onChange={(e) => setSecondaryEmail(e.target.value)}
                    placeholder="backup@email.com"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-3 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: accent }}
                >
                  {saving ? 'Saving...' : 'Save recovery email'}
                </button>
              </form>
            </Card>
          ) : null}

          {section === 'mobile' ? (
            <Card title="Mobile Numbers">
              <p className="mb-4 text-sm text-slate-500">
                Used for account recovery and optional login alerts.
              </p>
              <form onSubmit={saveMobile} className="rounded-xl border border-slate-200 p-4">
                <label className="block text-xs font-medium text-slate-600">
                  Mobile number
                  <input
                    value={mobileValue}
                    onChange={(e) => setMobileValue(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-3 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: accent }}
                >
                  {saving ? 'Saving...' : 'Save mobile'}
                </button>
              </form>
            </Card>
          ) : null}

          {section === 'security' ? (
            <Card title="Security">
              <p className="mb-4 text-sm text-slate-500">
                Change your password. Other devices will be signed out after a successful change.
              </p>
              <form onSubmit={savePassword} className="grid max-w-md gap-3">
                <label className="block text-xs font-medium text-slate-600">
                  Current password
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    required={user.authProvider !== 'google'}
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  New password
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    minLength={6}
                    required
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Confirm new password
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    minLength={6}
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: accent }}
                >
                  {saving ? 'Updating...' : 'Update password'}
                </button>
              </form>
            </Card>
          ) : null}

          {section === 'mfa' ? (
            <Card title="Multi-Factor Authentication">
              <p className="mb-4 text-sm text-slate-500">
                Use an authenticator app (TOTP). Backup codes are shown once when you enable MFA.
              </p>
              {!user.mfaEnabled ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={startMfaSetup}
                    className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold"
                  >
                    Generate authenticator secret
                  </button>
                  {mfaSetup?.secret ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <p className="font-mono text-xs break-all">Secret: {mfaSetup.secret}</p>
                      <p className="mt-2 text-xs text-slate-500 break-all">{mfaSetup.otpauthUrl}</p>
                      <input
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        placeholder="6-digit code from app"
                        className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2"
                      />
                      <button
                        type="button"
                        disabled={saving || !mfaCode}
                        onClick={() => toggleMfa(true)}
                        className="mt-3 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: accent }}
                      >
                        Confirm & enable MFA
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Status: Enabled</p>
                    <p className="mt-1 text-xs text-slate-500">Login will ask for a TOTP or backup code.</p>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => toggleMfa(false)}
                    className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: accent }}
                  >
                    Disable MFA
                  </button>
                </div>
              )}
              {backupCodes.length > 0 ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">Save these backup codes</p>
                  <ul className="mt-2 grid grid-cols-2 gap-2 font-mono text-sm text-amber-950">
                    {backupCodes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          ) : null}

          {section === 'settings' ? (
            <Card
              title="Settings"
              action={
                <button
                  type="button"
                  onClick={openCustomize}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open themes
                </button>
              }
            >
              {settingsForm ? (
                <form onSubmit={saveSettings} className="space-y-3">
                  <Toggle
                    checked={settingsForm.loginAlerts}
                    onChange={(v) => setSettingsForm((f) => ({ ...f, loginAlerts: v }))}
                    label="Login alerts"
                    hint="Get notified about new sign-ins when available"
                  />
                  <Toggle
                    checked={settingsForm.emailMarketing}
                    onChange={(v) => setSettingsForm((f) => ({ ...f, emailMarketing: v }))}
                    label="Product emails"
                    hint="Tips and product updates"
                  />
                  <Toggle
                    checked={settingsForm.shareAnalytics}
                    onChange={(v) => setSettingsForm((f) => ({ ...f, shareAnalytics: v }))}
                    label="Share usage analytics"
                    hint="Helps improve the product"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-slate-600">
                      Language
                      <select
                        value={settingsForm.language}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, language: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        {LANGUAGE_OPTIONS.map((l) => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-slate-600">
                      Time zone
                      <select
                        value={settingsForm.timeZone}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, timeZone: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        {TIMEZONE_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: accent }}
                  >
                    {saving ? 'Saving...' : 'Save settings'}
                  </button>
                </form>
              ) : null}
            </Card>
          ) : null}

          {section === 'sessions' ? (
            <Card
              title="Sessions"
              action={
                <button
                  type="button"
                  disabled={saving}
                  onClick={revokeOthers}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Sign out other sessions
                </button>
              }
            >
              {loadingSection ? <p className="text-sm text-slate-500">Loading sessions...</p> : null}
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {s.label}
                        {s.current ? (
                          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                            Current
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {s.ip || 'IP unknown'} · Last active {formatWhen(s.lastActiveAt)}
                      </p>
                    </div>
                    {!s.current ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => revokeSession(s.id)}
                        className="text-sm font-medium text-rose-600 hover:underline disabled:opacity-60"
                      >
                        Sign out
                      </button>
                    ) : null}
                  </div>
                ))}
                {!loadingSection && sessions.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No tracked sessions yet. Sign out and sign in again to start session tracking.
                  </p>
                ) : null}
              </div>
            </Card>
          ) : null}

          {section === 'groups' ? (
            <Card title="Groups">
              <p className="mb-4 text-sm text-slate-500">
                People with access to <strong>{user.tenant?.name || 'this workspace'}</strong>.
              </p>
              <form onSubmit={sendInvite} className="mb-4 flex flex-wrap gap-2">
                <input
                  required
                  type="email"
                  placeholder="teammate@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="min-w-[200px] flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="rounded-md border border-slate-200 px-2 py-2 text-sm"
                >
                  <option value="staff">Staff</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: accent }}
                >
                  Invite
                </button>
              </form>
              {loadingSection ? <p className="text-sm text-slate-500">Loading members...</p> : null}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Member</th>
                      <th className="px-4 py-2 font-medium">Role</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{m.user?.name || '—'}</p>
                          <p className="text-xs text-slate-500">{m.user?.email}</p>
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-700">{m.role}</td>
                        <td className="px-4 py-3 capitalize text-slate-700">{m.status}</td>
                        <td className="px-4 py-3 text-right">
                          {m.role !== 'owner' ? (
                            <button
                              type="button"
                              onClick={() => revokeMember(m.id)}
                              className="text-xs text-[#d03b3b]"
                            >
                              Remove
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!loadingSection && members.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-500">No members found.</p>
                ) : null}
              </div>
            </Card>
          ) : null}

          {section === 'privacy' ? (
            <Card title="Privacy">
              <p className="mb-4 text-sm text-slate-500">
                Download a copy of your account profile and workspace memberships.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={exportData}
                className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {saving ? 'Preparing...' : 'Download my data'}
              </button>
            </Card>
          ) : null}

          {section === 'compliance' ? (
            <Card title="Compliance">
              <p className="mb-4 text-sm text-slate-500">
                Recent account and workspace activity for audit.
              </p>
              {loadingSection ? <p className="text-sm text-slate-500">Loading activity...</p> : null}
              <div className="space-y-2">
                {logs.map((l) => (
                  <div key={l.id} className="rounded-xl border border-slate-200 px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{l.action}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {l.entityType || 'Account'} {l.entityId ? `· ${l.entityId}` : ''} ·{' '}
                      {formatWhen(l.createdAt)}
                    </p>
                  </div>
                ))}
                {!loadingSection && logs.length === 0 ? (
                  <p className="text-sm text-slate-500">No audit events yet for this account.</p>
                ) : null}
              </div>
            </Card>
          ) : null}
        </main>
      </div>

      <Modal
        open={editing}
        title="Edit profile"
        onClose={() => {
          if (!saving) setEditing(false);
        }}
        footer={
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="account-profile-form"
              disabled={saving}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        {form ? (
          <form id="account-profile-form" onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
              Full Name
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                required
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
              Display Name
              <input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Gender
              <select
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Country/Region
              <input
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              State
              <input
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Mobile
              <input
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Language
              <select
                value={form.language}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
              Time zone
              <select
                value={form.timeZone}
                onChange={(e) => setForm((f) => ({ ...f, timeZone: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {TIMEZONE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
