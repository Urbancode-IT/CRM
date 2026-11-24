import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import { BRAND_NAME } from '../constants/brand';

const FEATURES = [
  {
    title: 'Students & batches',
    body: 'Manage class students, grades, and batch details in one list.',
  },
  {
    title: 'Fee tracking',
    body: 'See monthly fees collected, pending, and overdue payments.',
  },
  {
    title: 'Attendance',
    body: 'Mark daily attendance and spot absences early.',
  },
  {
    title: 'Tasks',
    body: 'Keep follow-ups, reports, and class work organised.',
  },
];

export default function FeatureIntro() {
  const { user, dismissFeatureIntro } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (!user.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  if (user.featureIntroSeen) return <Navigate to="/app" replace />;

  async function finish() {
    setSubmitting(true);
    try {
      await dismissFeatureIntro();
      navigate('/app', { replace: true });
    } catch {
      navigate('/app', { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-100 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-brand-100 bg-white p-8 shadow-sm sm:p-10">
        <div className="mb-6 flex items-center gap-2.5">
          <BrandMark className="h-8 w-8" />
          <span className="font-display text-base font-semibold text-slate-700">{BRAND_NAME}</span>
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Your tuition dashboard is ready
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {user.instituteName
            ? `Setup saved for ${user.instituteName}. Here is what you can manage next.`
            : 'Here is what you can manage next.'}
        </p>

        <ul className="mt-8 space-y-4">
          {FEATURES.map((item) => (
            <li key={item.title} className="rounded-lg border border-slate-100 bg-brand-50 px-4 py-3">
              <div className="text-sm font-semibold text-slate-800">{item.title}</div>
              <p className="mt-1 text-sm text-slate-500">{item.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={finish}
            disabled={submitting}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-brand-100 disabled:opacity-60"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={submitting}
            className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? 'Opening...' : 'Open dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
