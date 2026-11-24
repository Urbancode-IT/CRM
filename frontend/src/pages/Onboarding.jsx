import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import { BRAND_NAME } from '../constants/brand';
import { postAuthPath } from '../utils/postAuthPath';

const TIME_ZONES = [
  { value: 'Asia/Kolkata', label: '(GMT 5:30) India Standard Time (Asia/Kolkata)' },
  { value: 'Asia/Dubai', label: '(GMT 4:00) Gulf Standard Time (Asia/Dubai)' },
  { value: 'America/New_York', label: '(GMT -5:00) Eastern Time (America/New_York)' },
  { value: 'Europe/London', label: '(GMT 0:00) Greenwich Mean Time (Europe/London)' },
];

const LANGUAGES = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'ta-IN', label: 'Tamil (India)' },
];

const CURRENCIES = [
  { value: 'India', label: 'India (INR)' },
  { value: 'United States', label: 'United States (USD)' },
  { value: 'United Arab Emirates', label: 'UAE (AED)' },
];

export default function Onboarding() {
  const { user, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const [instituteName, setInstituteName] = useState('');
  const [studentCount, setStudentCount] = useState('');
  const [timeZone, setTimeZone] = useState('Asia/Kolkata');
  const [language, setLanguage] = useState('en-US');
  const [currencyLocale, setCurrencyLocale] = useState('India');
  const [loadSample, setLoadSample] = useState(true);
  const [businessCategory, setBusinessCategory] = useState(user?.tenant?.businessCategory || 'tuition');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!user) return <Navigate to="/login" replace />;
  if (user.onboardingCompleted) {
    return <Navigate to={postAuthPath(user)} replace />;
  }

  const nameEmpty = !instituteName.trim();
  const showNameError = touched && nameEmpty;

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    setError('');
    if (nameEmpty) return;

    setSubmitting(true);
    try {
      await completeOnboarding({
        instituteName: instituteName.trim(),
        studentCount: studentCount === '' ? null : Number(studentCount),
        timeZone,
        language,
        currencyLocale,
        businessCategory,
        loadSampleData: loadSample,
      });
      navigate('/feature-intro', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not complete setup');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-4 py-10 lg:flex-row lg:items-stretch lg:gap-0">
        <aside className="flex flex-1 flex-col justify-between rounded-2xl bg-brand-700 p-8 text-white lg:rounded-r-none lg:px-10">
          <div>
            <div className="mb-10 flex items-center gap-3">
              <BrandMark className="h-9 w-9" />
              <span className="font-display text-lg font-semibold tracking-tight">{BRAND_NAME}</span>
            </div>
            <p className="text-sm font-medium text-brand-100">Account setup</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hi {user.name}</h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-brand-100">
              Set your institute details once. {BRAND_NAME} uses them for student fees, attendance,
              and class reports.
            </p>
          </div>
          <ul className="mt-10 space-y-3 text-sm text-brand-100">
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
              Students &amp; batches
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
              Monthly fee tracking
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
              Attendance &amp; tasks
            </li>
          </ul>
        </aside>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md self-center rounded-2xl border border-brand-100 bg-white p-7 shadow-sm lg:max-w-none lg:flex-1 lg:rounded-l-none lg:self-stretch lg:p-10"
          noValidate
        >
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Institute setup</h2>
          <p className="mb-6 text-sm text-slate-500">Required to open your tuition dashboard.</p>

          {error && (
            <div className="mb-4 rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>
          )}

          <label className="mb-1 block text-xs font-medium text-slate-600">Institute / class name</label>
          <input
            type="text"
            value={instituteName}
            onChange={(e) => setInstituteName(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g. Bright Minds Tuition / AquaSwim Academy"
            className={`w-full rounded-md border px-3 py-2.5 text-sm outline-none transition ${
              showNameError
                ? 'border-[#e05a5a] focus:border-[#e05a5a]'
                : 'border-brand-200 focus:border-brand-500'
            }`}
          />
          {showNameError && (
            <p className="mt-1 text-xs text-[#d03b3b]">Institute name is required.</p>
          )}

          <label className="mb-1 mt-4 block text-xs font-medium text-slate-600">
            Student count
          </label>
          <input
            type="number"
            min="0"
            value={studentCount}
            onChange={(e) => setStudentCount(e.target.value)}
            placeholder="Optional"
            className="mb-4 w-full rounded-md border border-brand-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          />

          <label className="mb-1 block text-xs font-medium text-slate-600">Business category</label>
          <select
            value={businessCategory}
            onChange={(e) => setBusinessCategory(e.target.value)}
            className="mb-4 w-full rounded-md border border-brand-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="tuition">Tuition / Coaching</option>
            <option value="swimming">Swimming class</option>
            <option value="dance">Dance class</option>
            <option value="music">Music / Instrument class</option>
            <option value="sports">Sports / Fitness class</option>
            <option value="school">School / Education</option>
            <option value="training">Training Institute</option>
            <option value="service">Service Business</option>
            <option value="other">Other</option>
          </select>

          <label className="mb-1 block text-xs font-medium text-slate-600">Time zone</label>
          <select
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            className="mb-4 w-full rounded-md border border-brand-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            {TIME_ZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>

          <label className="mb-1 block text-xs font-medium text-slate-600">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mb-4 w-full rounded-md border border-brand-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          <label className="mb-1 block text-xs font-medium text-slate-600">Currency</label>
          <select
            value={currencyLocale}
            onChange={(e) => setCurrencyLocale(e.target.value)}
            className="mb-5 w-full rounded-md border border-brand-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <label className="mb-6 flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={loadSample}
              onChange={(e) => setLoadSample(e.target.checked)}
              className="h-4 w-4 rounded border-brand-200 text-brand-600 focus:ring-brand-500"
            />
            Load sample student data
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
