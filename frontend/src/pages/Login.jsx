import { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postAuthPath } from '../utils/postAuthPath';
import BrandMark from '../components/BrandMark';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { BRAND_NAME, BRAND_TAGLINE } from '../constants/brand';
import { useTheme } from '../context/ThemeContext';

export default function Login() {
  const { login, verifyMfa, loginWithOtp, loginWithGoogle, user, loading } = useAuth();
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mode, setMode] = useState('password'); // password | otp | mfa
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleCredential = useCallback(
    async (credential) => {
      setError('');
      const result = await loginWithGoogle(credential);
      if (result?.mfaRequired) {
        setMfaToken(result.mfaToken);
        setMode('mfa');
        setMessage(result.message || 'Enter authenticator code');
        return;
      }
      navigate(postAuthPath(result));
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
    setMessage('');
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result?.mfaRequired) {
        setMfaToken(result.mfaToken);
        setMode('mfa');
        setMessage(result.message || 'Enter authenticator code');
        return;
      }
      navigate(postAuthPath(result));
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfa(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedInUser = await verifyMfa(mfaToken, mfaCode);
      navigate(postAuthPath(loggedInUser));
    } catch (err) {
      setError(err.response?.data?.message || 'MFA failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function requestOtp(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const { default: api } = await import('../services/api');
      const res = await api.post('/auth/otp/request', { phone, email: phone ? undefined : email });
      setMessage(res.data.message || 'OTP sent');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedInUser = await loginWithOtp({ phone, email: phone ? undefined : email, code: otpCode });
      navigate(postAuthPath(loggedInUser));
    } catch (err) {
      setError(err.response?.data?.message || 'OTP login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <section
        className="relative flex flex-1 flex-col justify-between overflow-hidden px-8 py-8 text-white lg:max-w-[420px] lg:px-10 lg:py-10"
        style={{
          background: `linear-gradient(165deg, ${colors.sidebar} 0%, ${colors[800]} 55%, ${colors[600]} 100%)`,
        }}
      >
        <Link to="/" className="relative z-10 flex items-center gap-2.5">
          <BrandMark className="h-9 w-9" color={colors[500]} />
          <span className="font-display text-xl font-semibold tracking-tight">{BRAND_NAME}</span>
        </Link>

        <div className="relative z-10 animate-fade-up py-12 lg:py-0">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
            Class workspace
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {BRAND_NAME}
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-white/80">{BRAND_TAGLINE}</p>
          <ul className="mt-8 space-y-2.5 text-sm text-white/70">
            {['Students & batches', 'Attendance tracking', 'Fees & collections', 'Daily tasks'].map(
              (item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: colors[500] }}
                  >
                    ✓
                  </span>
                  {item}
                </li>
              )
            )}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/45">Secure sign-in · Encrypted session</p>

        <div
          className="pointer-events-none absolute -right-16 top-24 h-56 w-56 rounded-full opacity-20"
          style={{ background: colors[300] }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full opacity-15"
          style={{ background: colors[200] }}
        />
      </section>

      <section className="relative flex flex-1 flex-col bg-[#f7f9fc]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.45]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 85% 10%, rgba(55,102,245,0.08), transparent 40%), radial-gradient(circle at 10% 90%, rgba(37,73,209,0.06), transparent 35%)',
          }}
        />

        <header className="relative z-10 flex items-center justify-end gap-5 px-6 py-5 sm:px-10">
          <Link to="/" className="text-sm text-slate-500 transition hover:text-slate-900">
            Home
          </Link>
          <Link
            to="/register"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300"
          >
            Register
          </Link>
        </header>

        <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
          <div className="w-full max-w-[400px] animate-fade-up-delay rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.25)]">
            <div className="mb-7">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
                Sign in
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                Open your class workspace on {BRAND_NAME}
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                {error}
              </div>
            )}
            {message && (
              <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
                {message}
              </div>
            )}

            <div className="mb-4 flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMode('password')}
                className={`rounded-md px-2 py-1 ${mode === 'password' || mode === 'mfa' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setMode('otp')}
                className={`rounded-md px-2 py-1 ${mode === 'otp' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                SMS / OTP
              </button>
              <Link to="/parent" className="ml-auto rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                Parent portal
              </Link>
            </div>

            {mode !== 'otp' && mode !== 'mfa' && (
            <GoogleSignInButton
              onCredential={handleGoogleCredential}
              onError={handleGoogleError}
              label="Continue with Google"
            />
            )}

            {mode === 'mfa' ? (
              <form onSubmit={handleMfa} className="mt-4">
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Authenticator / backup code</label>
                <input
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="mb-4 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm tracking-widest"
                  placeholder="123456"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl px-3 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: colors[600] }}
                >
                  {submitting ? 'Verifying…' : 'Verify & sign in'}
                </button>
              </form>
            ) : mode === 'otp' ? (
              <form className="mt-2 space-y-3">
                <input
                  placeholder="Phone (with country) or leave blank & use email"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                />
                {!phone && (
                  <input
                    type="email"
                    placeholder="Email for OTP"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                  />
                )}
                <input
                  placeholder="6-digit code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm tracking-widest"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={requestOtp}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  >
                    Send OTP
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={verifyOtp}
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-white"
                    style={{ backgroundColor: colors[600] }}
                  >
                    Verify
                  </button>
                </div>
              </form>
            ) : (
            <>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                or email
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleSubmit}>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@institute.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
              />

              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-600">Password</label>
              </div>
              <div className="relative mb-6">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 transition hover:text-slate-700"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.5a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:opacity-95 disabled:opacity-60"
                style={{ backgroundColor: colors[600] }}
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            </>
            )}

            <p className="mt-7 text-center text-sm text-slate-500">
              New here?{' '}
              <Link to="/register" className="font-semibold text-slate-900 hover:underline">
                Create a workspace
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
