import { useEffect, useState } from 'react';
import api from '../services/api';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [overview, setOverview] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadAll(y = year, m = month) {
    setError('');
    setLoading(true);
    try {
      const [ov, att] = await Promise.all([
        api.get('/reports/overview', { params: { year: y, month: m } }),
        api.get('/reports/attendance', { params: { year: y, month: m } }),
      ]);
      setOverview(ov.data);
      setAttendance(att.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function download(path, filename) {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const tenant = localStorage.getItem('tuition_tenant');
    const url = `${base}${path}${path.includes('?') ? '&' : '?'}format=csv`;
    fetch(url, {
      credentials: 'include',
      headers: {
        ...(tenant ? { 'x-tenant-id': tenant } : {}),
      },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
      })
      .catch(() => setError('Download failed'));
  }

  const fees = overview?.fees;
  const leads = overview?.leads;
  const att = overview?.attendance;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Collection, attendance, and lead conversion for {MONTHS[month - 1]} {year}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-slate-500">Year</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24 rounded-lg border border-slate-200 px-2 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-slate-500">Month</span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-lg border border-slate-200 px-2 py-1.5"
            >
              {MONTHS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => loadAll(year, month)}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}

      {loading && !overview ? (
        <p className="text-sm text-slate-500">Loading dashboard…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Collected"
              value={`₹${Number(fees?.collected || 0).toLocaleString('en-IN')}`}
              hint={`${fees?.invoiceCount || 0} invoices`}
            />
            <Stat
              label="Pending"
              value={`₹${Number(fees?.pending || 0).toLocaleString('en-IN')}`}
              hint={`${fees?.overdueCount || 0} overdue`}
            />
            <Stat
              label="Attendance"
              value={`${att?.percent ?? 0}%`}
              hint={`${att?.present || 0}/${att?.total || 0} present+late`}
            />
            <Stat
              label="Lead conversion"
              value={`${leads?.conversionRate ?? 0}%`}
              hint={`${leads?.converted || 0} converted · ${leads?.total || 0} leads`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Lead funnel</h2>
              {!leads?.total ? (
                <p className="mt-3 text-sm text-slate-500">
                  Enable Leads module and add enquiries to see conversion.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {Object.entries(leads.byStatus || {}).map(([status, count]) => (
                    <li key={status} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{status}</span>
                      <span className="font-semibold text-slate-900">{count}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
                    <span className="text-slate-600">Won</span>
                    <span className="font-semibold text-emerald-700">{leads.won || 0}</span>
                  </li>
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Exports</h2>
              <p className="mt-1 text-xs text-slate-500">Download CSV for the selected month.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ExportBtn
                  onClick={() =>
                    download(`/reports/fees?year=${year}&month=${month}`, `fees-${year}-${month}.csv`)
                  }
                  label="Fees CSV"
                />
                <ExportBtn
                  onClick={() =>
                    download(
                      `/reports/attendance?year=${year}&month=${month}`,
                      `attendance-${year}-${month}.csv`
                    )
                  }
                  label="Attendance CSV"
                />
                <ExportBtn
                  onClick={() => download('/reports/students', 'students.csv')}
                  label="Students CSV"
                />
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Active students: <span className="font-medium text-slate-800">{overview?.students?.active ?? 0}</span>
              </p>
            </section>
          </div>

          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
              Attendance by student
            </div>
            <table className="w-full min-w-[480px] table-fixed text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Student</th>
                  <th className="px-2 py-2.5 text-center font-medium">Present</th>
                  <th className="px-2 py-2.5 text-center font-medium">Absent</th>
                  <th className="px-2 py-2.5 text-center font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {(attendance?.rows || []).map((r) => (
                  <tr key={r.student} className="border-t border-slate-100">
                    <td className="truncate px-4 py-2.5 font-medium text-slate-900">{r.student}</td>
                    <td className="px-2 py-2.5 text-center text-emerald-700">{r.present}</td>
                    <td className="px-2 py-2.5 text-center text-rose-600">{r.absent}</td>
                    <td className="px-2 py-2.5 text-center font-semibold">{r.attendancePercent}%</td>
                  </tr>
                ))}
                {(attendance?.rows || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      No attendance rows for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function ExportBtn({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
    >
      {label}
    </button>
  );
}
