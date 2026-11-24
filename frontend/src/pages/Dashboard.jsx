import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { formatMoney, formatDate } from '../utils/format';

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/dashboard')
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'));
  }, []);

  if (error) return <div className="text-sm text-[#d03b3b]">{error}</div>;
  if (!summary) return <div className="text-sm text-slate-500">Loading dashboard...</div>;

  const monthLabel = new Date(summary.monthlyFee.year, summary.monthlyFee.month - 1, 1).toLocaleString(
    'default',
    { month: 'long', year: 'numeric' }
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Overview for {monthLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active students" value={summary.activeStudents} sublabel={`${summary.totalStudents} total`} />
        <StatCard
          label="Fee collected"
          value={formatMoney(summary.monthlyFee.collected, user?.currencyLocale)}
          sublabel={monthLabel}
          status="good"
        />
        <StatCard
          label="Fee pending"
          value={formatMoney(summary.monthlyFee.pending, user?.currencyLocale)}
          sublabel={`${summary.monthlyFee.recordCount} record(s)`}
          status={summary.monthlyFee.pending > 0 ? 'warning' : 'good'}
        />
        <StatCard
          label="Overdue payments"
          value={summary.overduePayments.length}
          status={summary.overduePayments.length > 0 ? 'critical' : 'good'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard
          label="Today's attendance"
          value={summary.todayAttendance.rate !== null ? `${summary.todayAttendance.rate}%` : 'Not marked yet'}
          sublabel={`${summary.todayAttendance.present}/${summary.todayAttendance.marked} present`}
          status={summary.todayAttendance.rate === null || summary.todayAttendance.rate >= 80 ? 'good' : 'warning'}
        />
        <StatCard label="Pending tasks" value={summary.pendingTasksCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm shadow-brand-900/5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Overdue payments</h2>
          {summary.overduePayments.length === 0 ? (
            <p className="text-sm text-slate-400">No overdue payments. Nice.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {summary.overduePayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <Link to={`/app/students/${p.student?.id}`} className="font-medium text-slate-900 hover:underline">
                    {p.student?.name || 'Unknown student'}
                  </Link>
                  <span className="text-slate-700">
                    {formatMoney(p.amount, user?.currencyLocale)} due{' '}
                    {formatDate(p.dueDate, user?.timeZone)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm shadow-brand-900/5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Upcoming tasks</h2>
          {summary.upcomingTasks.length === 0 ? (
            <p className="text-sm text-slate-400">No upcoming tasks.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {summary.upcomingTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-800">
                    {t.title} {t.student ? `(${t.student})` : ''}
                  </span>
                  <span className="text-slate-400">
                    {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
