import { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postAuthPath } from '../utils/postAuthPath';
import BrandMark from '../components/BrandMark';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { BRAND_NAME } from '../constants/brand';

const CATEGORIES = [
  { value: 'tuition', label: 'Tuition / Coaching' },
  { value: 'swimming', label: 'Swimming class' },
  { value: 'dance', label: 'Dance class' },
  { value: 'music', label: 'Music / Instrument class' },
  { value: 'sports', label: 'Sports / Fitness class' },
  { value: 'school', label: 'School / Education' },
  { value: 'training', label: 'Training Institute' },
  { value: 'service', label: 'Service Business' },
  { value: 'other', label: 'Other' },
];

export default function Register() {
  const { register, loginWithGoogle, user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    businessName: '',
    businessCategory: 'tuition',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleCredential = useCallback(
    async (credential) => {
      setError('');
      const created = await loginWithGoogle(credential);
      navigate(postAuthPath(created));
    },
    [loginWithGoogle, navigate]
  );

  const handleGoogleError = useCallback((message) => {
    setError(message || 'Google Sign-In failed');
  }, []);

  if (!loading && user) {
    return <Navigate to={postAuthPath(user)} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const created = await register(form);
      navigate(postAuthPath(created));
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f9fc]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <BrandMark className="h-8 w-8" />
          <span className="font-display text-lg font-semibold text-slate-900">{BRAND_NAME}</span>
        </Link>
        <Link
          to="/login"
          className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-800 shadow-sm"
        >
          Login
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.25)]"
        >
          <h1 className="mb-1 font-display text-xl font-bold text-slate-900">Create your workspace</h1>
          <p className="mb-6 text-sm text-slate-500">Start a 14-day free trial on {BRAND_NAME}.</p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <GoogleSignInButton
            onCredential={handleGoogleCredential}
            onError={handleGoogleError}
            label="Continue with Google"
          />

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              or email
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {[
            ['name', 'Your name', 'text'],
            ['email', 'Email', 'email'],
            ['password', 'Password', 'password'],
            ['businessName', 'Business / institute name', 'text'],
          ].map(([key, label, type]) => (
            <div key={key} className="mb-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
              <input
                type={type}
                required
                minLength={key === 'password' ? 6 : undefined}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          ))}

          <label className="mb-1 block text-xs font-medium text-slate-600">Business category</label>
          <select
            value={form.businessCategory}
            onChange={(e) => setForm({ ...form, businessCategory: e.target.value })}
            className="mb-6 w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Start free trial'}
          </button>
        </form>
      </div>
    </div>
  );
}
