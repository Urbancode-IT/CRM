import { useEffect, useState } from 'react';
import api from '../services/api';
import BrandMark from '../components/BrandMark';
import { BRAND_NAME } from '../constants/brand';
import { formatMoney, formatDate } from '../utils/format';

export default function ParentPortal() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('request');
  const [token, setToken] = useState(() => localStorage.getItem('tusion_parent_token') || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function requestCode(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/parent/request', { email, phone });
      setMessage(res.data.message || 'Code sent');
      setStep('verify');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send code');
    }
  }

  async function verify(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/parent/verify', { email, phone, code });
      localStorage.setItem('tusion_parent_token', res.data.token);
      setToken(res.data.token);
      setStep('done');
      await loadDashboard(res.data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code');
    }
  }

  async function loadDashboard(activeToken = token) {
    const res = await api.get('/parent/dashboard', {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    setData(res.data);
  }

  function logout() {
    localStorage.removeItem('tusion_parent_token');
    setToken('');
    setData(null);
    setStep('request');
  }

  useEffect(() => {
    if (!token || data) return undefined;
    let cancelled = false;
    loadDashboard(token).catch((err) => {
      if (cancelled) return;
      setError(err.response?.data?.message || 'Session expired');
      logout();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-2">
          <BrandMark className="h-9 w-9" />
          <div>
            <p className="font-display text-xl font-semibold">{BRAND_NAME}</p>
            <p className="text-xs text-slate-500">Parent portal</p>
          </div>
        </div>

        {error && <div className="mb-4 rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}
        {message && <div className="mb-4 rounded-md bg-[#eaf7ea] px-3 py-2 text-sm text-[#0ca30c]">{message}</div>}

        {!token && step === 'request' && (
          <form onSubmit={requestCode} className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold">View your child’s fees & attendance</h1>
            <p className="mt-1 text-sm text-slate-500">Use the parent email or phone saved on the student profile.</p>
            <div className="mt-4 grid gap-3">
              <input
                type="email"
                placeholder="Parent email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border border-brand-200 px-3 py-2 text-sm"
              />
              <input
                placeholder="Parent phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-md border border-brand-200 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white">
                Send access code
              </button>
            </div>
          </form>
        )}

        {!token && step === 'verify' && (
          <form onSubmit={verify} className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold">Enter code</h1>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-4 w-full rounded-md border border-brand-200 px-3 py-2 text-sm tracking-widest"
              placeholder="6-digit code"
            />
            <button type="submit" className="mt-3 w-full rounded-md bg-brand-600 px-3 py-2 text-sm text-white">
              Open portal
            </button>
          </form>
        )}

        {token && data && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">Your children</h1>
              <button type="button" onClick={logout} className="text-sm text-slate-500 underline">
                Sign out
              </button>
            </div>
            {(data.students || []).map((s) => (
              <div key={s._id} className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.grade || '—'} · {s.batch || '—'} · fee {formatMoney(s.monthlyFee)}
                </p>
              </div>
            ))}
            <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Recent payments</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {(data.payments || []).slice(0, 12).map((p) => (
                  <li key={p._id} className="flex justify-between border-b border-slate-50 py-1">
                    <span>
                      {p.month}/{p.year} · {p.status}
                    </span>
                    <span>{formatMoney(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Last 30 days attendance</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {(data.attendance || []).slice(0, 20).map((a) => (
                  <li key={a._id} className="flex justify-between border-b border-slate-50 py-1">
                    <span>{formatDate(a.date)}</span>
                    <span className="capitalize">{a.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
