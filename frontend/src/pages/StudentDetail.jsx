import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function StudentDetail() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [payments, setPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  function load() {
    api.get(`/students/${id}`).then((res) => setStudent(res.data));
    api.get('/payments', { params: { student: id } }).then((res) => setPayments(res.data));
    api.get('/attendance', { params: { student: id } }).then((res) => setAttendance(res.data.slice(0, 30)));
    api.get('/tasks', { params: { student: id } }).then((res) => setTasks(res.data));
  }

  useEffect(load, [id]);

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const res = await api.get(`/analysis/${id}`);
      setAnalysis(res.data);
    } catch (err) {
      setAnalysisError(err.response?.data?.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  if (!student) return <div className="text-sm text-slate-500">Loading...</div>;

  const counted = attendance.filter((a) => a.status !== 'holiday');
  const present = counted.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendanceRate = counted.length ? Math.round((present / counted.length) * 100) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/app/students" className="text-sm text-slate-700 hover:underline">
          &larr; Back to students
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">{student.name}</h1>
        <p className="text-sm text-slate-500">
          {student.grade || 'No grade set'}
          {student.batch ? ` · Batch: ${student.batch}` : ''} ·{' '}
          {(student.subjects || []).join(', ') || 'No subjects set'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoCard title="Contact">
          <p>Student: {student.email || '-'} / {student.phone || '-'}</p>
          <p>Parent: {student.parentName || '-'}</p>
          <p>{student.parentEmail || '-'} / {student.parentPhone || '-'}</p>
        </InfoCard>
        <InfoCard title="Fees">
          <p>Monthly fee: {student.monthlyFee}</p>
          <p>Status: {student.status}</p>
        </InfoCard>
        <InfoCard title="Attendance (last 30 records)">
          <p>{attendanceRate !== null ? `${attendanceRate}% present` : 'No records yet'}</p>
        </InfoCard>
      </div>

      <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">AI progress analysis</h2>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {analyzing ? 'Analyzing...' : 'Run analysis'}
          </button>
        </div>
        {analysisError && <p className="text-sm text-[#d03b3b]">{analysisError}</p>}
        {analysis && (
          <div className="text-sm text-slate-700">
            {!analysis.aiGenerated && (
              <p className="mb-2 rounded-md bg-[#fff6e5] px-3 py-2 text-[#b8790f]">{analysis.analysis}</p>
            )}
            {analysis.aiGenerated && <pre className="whitespace-pre-wrap font-sans">{analysis.analysis}</pre>}
          </div>
        )}
        {!analysis && !analysisError && (
          <p className="text-sm text-slate-500">Run analysis to get an AI-generated progress summary and suggestions.</p>
        )}
      </section>

      <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Payment history</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-1">Period</th>
              <th className="py-1">Amount</th>
              <th className="py-1">Status</th>
              <th className="py-1">Due</th>
              <th className="py-1">Paid</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p._id} className="border-t border-slate-100">
                <td className="py-1">{p.month}/{p.year}</td>
                <td className="py-1">{p.amount}</td>
                <td className="py-1">
                  <StatusPill status={p.status} />
                </td>
                <td className="py-1">{new Date(p.dueDate).toLocaleDateString()}</td>
                <td className="py-1">{p.paidDate ? new Date(p.paidDate).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-slate-500">No payment records yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Tasks</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {tasks.map((t) => (
            <li key={t._id} className="flex items-center justify-between border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
              <span>{t.title}</span>
              <StatusPill status={t.status} />
            </li>
          ))}
          {tasks.length === 0 && <p className="text-slate-500">No tasks yet.</p>}
        </ul>
      </section>
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}

const STATUS_COLORS = {
  paid: 'bg-[#eaf7ea] text-[#0ca30c]',
  completed: 'bg-[#eaf7ea] text-[#0ca30c]',
  present: 'bg-[#eaf7ea] text-[#0ca30c]',
  pending: 'bg-[#fff6e5] text-[#b8790f]',
  in_progress: 'bg-[#fff6e5] text-[#b8790f]',
  overdue: 'bg-[#fdeaea] text-[#d03b3b]',
  absent: 'bg-[#fdeaea] text-[#d03b3b]',
};

function StatusPill({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[status] || 'bg-brand-100 text-slate-500'}`}>
      {status}
    </span>
  );
}
