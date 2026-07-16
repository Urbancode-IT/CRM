import { useEffect, useState } from 'react';
import api from '../services/api';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Attendance() {
  const [date, setDate] = useState(todayStr());
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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

  function setMark(studentId, status) {
    setMarks((prev) => ({ ...prev, [studentId]: status }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const entries = students.map((s) => ({ student: s._id, status: marks[s._id] || 'present' }));
      await api.post('/attendance/mark-bulk', { date, entries });
      setMessage('Attendance saved.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Attendance</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />
      </div>

      <p className="text-xs text-slate-500">
        Any student left unmarked will be automatically marked absent by the end-of-day automation job.
      </p>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s._id} className="border-t border-slate-100">
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    {['present', 'late', 'absent', 'holiday'].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setMark(s._id, opt)}
                        className={`rounded-full px-3 py-1 text-xs capitalize ${
                          (marks[s._id] || 'present') === opt
                            ? 'bg-brand-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={2} className="px-4 py-6 text-center text-slate-500">No active students.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || students.length === 0}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save attendance'}
        </button>
        {message && <span className="text-sm text-slate-600">{message}</span>}
      </div>
    </div>
  );
}
