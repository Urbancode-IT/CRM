import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const STATUS_OPTIONS = [
  {
    id: 'present',
    label: 'Present',
    active: 'bg-[#0ca30c] text-white ring-2 ring-[#0ca30c]/30',
    idle: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
  },
  {
    id: 'late',
    label: 'Late',
    active: 'bg-[#b8790f] text-white ring-2 ring-[#b8790f]/30',
    idle: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
  },
  {
    id: 'absent',
    label: 'Absent',
    active: 'bg-[#d03b3b] text-white ring-2 ring-[#d03b3b]/30',
    idle: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
  },
  {
    id: 'holiday',
    label: 'Holiday',
    active: 'bg-[#4338ca] text-white ring-2 ring-[#4338ca]/30',
    idle: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
  },
];

export default function Attendance() {
  const [date, setDate] = useState(todayStr());
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [batchFilter, setBatchFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [reportMonth, setReportMonth] = useState(currentMonthValue());
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    api.get('/students', { params: { status: 'active' } }).then((res) => setStudents(res.data));
  }, []);

  useEffect(() => {
    api.get('/attendance', { params: { date } }).then((res) => {
      const map = {};
      res.data.forEach((a) => {
        map[a.student?._id || a.student] = a.status;
      });
      setMarks(map);
    });
  }, [date]);

  useEffect(() => {
    const [year, month] = reportMonth.split('-').map(Number);
    setReportLoading(true);
    setReportError('');
    api
      .get('/attendance/report/monthly', { params: { year, month } })
      .then((res) => setReport(res.data))
      .catch((err) => setReportError(err.response?.data?.message || 'Failed to load monthly report'))
      .finally(() => setReportLoading(false));
  }, [reportMonth]);

  const batches = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      if (s.batch?.trim()) set.add(s.batch.trim());
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [students]);

  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (batchFilter !== 'all' && (s.batch || '').trim() !== batchFilter) return false;
      if (q && !(s.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [students, batchFilter, search]);

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, holiday: 0 };
    visibleStudents.forEach((s) => {
      const status = marks[s._id] || 'present';
      if (c[status] !== undefined) c[status] += 1;
    });
    return c;
  }, [visibleStudents, marks]);

  function setMark(studentId, status) {
    setMarks((prev) => ({ ...prev, [studentId]: status }));
  }

  /** Bulk mark only the currently visible list (batch / search), not the whole school. */
  function markVisible(status) {
    setMarks((prev) => {
      const next = { ...prev };
      visibleStudents.forEach((s) => {
        next[s._id] = status;
      });
      return next;
    });
    const scope =
      batchFilter === 'all' && !search.trim()
        ? 'all students'
        : batchFilter !== 'all'
          ? `batch "${batchFilter}"`
          : 'filtered students';
    setMessage(
      status === 'holiday'
        ? `${scope}: set to Holiday — click Save to confirm.`
        : `${scope}: set to ${status} — click Save. Then flip only Late / Absent.`
    );
  }

  async function handleSave() {
    if (visibleStudents.length === 0) return;
    setSaving(true);
    setMessage('');
    try {
      // Save only the visible batch/list so other batches stay untouched.
      const entries = visibleStudents.map((s) => ({
        student: s._id,
        status: marks[s._id] || 'present',
      }));
      await api.post('/attendance/mark-bulk', { date, entries });
      const holidayOnly = entries.every((e) => e.status === 'holiday');
      setMessage(
        holidayOnly
          ? `Holiday saved for ${entries.length} student(s).`
          : `Attendance saved for ${entries.length} student(s).`
      );
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  }

  const reportLabel = useMemo(() => {
    if (!report) return '';
    return new Date(report.year, report.month - 1, 1).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
  }, [report]);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Attendance</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Large class tip: filter one batch → Mark all Present → flip only Late/Absent → Save.
              Repeat for the next batch.
            </p>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Batch</label>
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="rounded-md border border-brand-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="all">All batches ({students.length})</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value="">No batch set</option>
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            Showing <span className="font-semibold text-slate-900">{visibleStudents.length}</span>
            {' · '}
            <span className="text-[#0ca30c]">{counts.present} P</span>
            {' · '}
            <span className="text-[#b8790f]">{counts.late} L</span>
            {' · '}
            <span className="text-[#d03b3b]">{counts.absent} A</span>
            {' · '}
            <span className="text-[#4338ca]">{counts.holiday} H</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => markVisible('present')}
            disabled={visibleStudents.length === 0}
            className="rounded-md border border-[#0ca30c]/30 bg-[#eaf7ea] px-3 py-1.5 text-xs font-medium text-[#0ca30c] hover:bg-[#dcf0dc] disabled:opacity-50"
          >
            Mark listed Present
          </button>
          <button
            type="button"
            onClick={() => markVisible('absent')}
            disabled={visibleStudents.length === 0}
            className="rounded-md border border-[#d03b3b]/30 bg-[#fdeaea] px-3 py-1.5 text-xs font-medium text-[#d03b3b] hover:bg-[#f8d4d4] disabled:opacity-50"
          >
            Mark listed Absent
          </button>
          <button
            type="button"
            onClick={() => markVisible('holiday')}
            disabled={visibleStudents.length === 0}
            className="rounded-md border border-[#4338ca]/30 bg-[#eef2ff] px-3 py-1.5 text-xs font-medium text-[#4338ca] hover:bg-[#e0e7ff] disabled:opacity-50"
          >
            Mark listed Holiday
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-brand-100 bg-white shadow-sm">
          <table className="w-full min-w-[560px] table-fixed text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[20%]" />
              <col className="w-[52%]" />
            </colgroup>
            <thead className="bg-brand-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Student</th>
                <th className="px-4 py-2.5 text-left font-medium">Batch</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((s) => {
                const current = marks[s._id] || 'present';
                return (
                  <tr key={s._id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 align-middle font-medium text-slate-900">{s.name}</td>
                    <td className="px-4 py-2.5 align-middle text-slate-600">{s.batch || '—'}</td>
                    <td className="px-4 py-2.5 align-middle">
                      <div className="flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map((opt) => {
                          const selected = current === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setMark(s._id, opt.id)}
                              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                                selected ? opt.active : opt.idle
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleStudents.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    {students.length === 0
                      ? 'No active students.'
                      : 'No students in this batch / search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || visibleStudents.length === 0}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving
              ? 'Saving...'
              : `Save ${visibleStudents.length} student${visibleStudents.length === 1 ? '' : 's'}`}
          </button>
          <span className="text-xs text-slate-500">
            Saves only the list on screen — other batches stay as they are.
          </span>
          {message && <span className="w-full text-sm text-slate-600 sm:w-auto">{message}</span>}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Monthly student report</h2>
            <p className="text-xs text-slate-500">
              Holiday days are excluded from attendance percentage.
            </p>
          </div>
          <input
            type="month"
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
            className="rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>

        {reportError && <div className="text-sm text-[#d03b3b]">{reportError}</div>}
        {reportLoading && <div className="text-sm text-slate-500">Loading report...</div>}

        {!reportLoading && report && (
          <div className="overflow-x-auto rounded-xl border border-brand-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-800">
              {reportLabel} · {report.daysInMonth} calendar days
            </div>
            <table className="w-full min-w-[640px] table-fixed text-sm">
              <colgroup>
                <col className="w-[32%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead className="bg-brand-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Student</th>
                  <th className="px-2 py-2.5 text-center font-medium">Present</th>
                  <th className="px-2 py-2.5 text-center font-medium">Late</th>
                  <th className="px-2 py-2.5 text-center font-medium">Absent</th>
                  <th className="px-2 py-2.5 text-center font-medium">Holiday</th>
                  <th className="px-4 py-2.5 text-center font-medium">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {report.students.map((row) => (
                  <tr key={row.studentId} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 text-left align-middle">
                      <Link
                        to={`/app/students/${row.studentId}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {row.name}
                      </Link>
                      {(row.grade || row.batch) && (
                        <div className="text-xs text-slate-500">
                          {[row.grade, row.batch].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center align-middle font-medium text-[#0ca30c]">
                      {row.present}
                    </td>
                    <td className="px-2 py-2.5 text-center align-middle font-medium text-[#b8790f]">
                      {row.late}
                    </td>
                    <td className="px-2 py-2.5 text-center align-middle font-medium text-[#d03b3b]">
                      {row.absent}
                    </td>
                    <td className="px-2 py-2.5 text-center align-middle font-medium text-[#4338ca]">
                      {row.holiday}
                    </td>
                    <td className="px-4 py-2.5 text-center align-middle font-semibold text-slate-900">
                      {row.attendanceRate !== null ? `${row.attendanceRate}%` : '—'}
                    </td>
                  </tr>
                ))}
                {report.students.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No active students for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
