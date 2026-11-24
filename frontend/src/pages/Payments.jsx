import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const METHODS = ['Cash', 'UPI', 'Bank', 'Card', 'Other'];

function endOfMonthIso(year, month) {
  const d = new Date(year, month, 0);
  return d.toISOString().slice(0, 10);
}

export default function Payments() {
  const now = new Date();
  const [payments, setPayments] = useState([]);
  const [status, setStatus] = useState('');
  const [students, setStudents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    student: '',
    amount: '',
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    dueDate: endOfMonthIso(now.getFullYear(), now.getMonth() + 1),
    method: 'UPI',
  });
  const [payMethod, setPayMethod] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    api.get('/payments', { params: status ? { status } : {} }).then((res) => setPayments(res.data));
  }

  useEffect(load, [status]);
  useEffect(() => {
    api.get('/students', { params: { status: 'active' } }).then((res) => setStudents(res.data));
  }, []);

  const summary = useMemo(() => {
    const collected = payments
      .filter((p) => p.status === 'paid')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const pending = payments
      .filter((p) => p.status === 'pending' || p.status === 'overdue')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const overdue = payments.filter((p) => p.status === 'overdue').length;
    return { collected, pending, overdue, count: payments.length };
  }, [payments]);

  function onStudentPick(studentId) {
    const s = students.find((x) => x._id === studentId);
    const year = Number(form.year) || now.getFullYear();
    const month = Number(form.month) || now.getMonth() + 1;
    setForm({
      ...form,
      student: studentId,
      amount: s?.monthlyFee != null ? String(s.monthlyFee) : form.amount,
      dueDate: endOfMonthIso(year, month),
    });
  }

  async function handleMarkPaid(id) {
    setError('');
    setMessage('');
    try {
      await api.patch(`/payments/${id}/mark-paid`, {
        method: payMethod[id] || 'UPI',
      });
      setMessage('Marked paid · receipt emailed if parent email exists');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Mark paid failed');
    }
  }

  function openReceipt(id) {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const tenant = localStorage.getItem('tuition_tenant');
    fetch(`${base}/payments/${id}/receipt`, {
      credentials: 'include',
      headers: {
        ...(tenant ? { 'x-tenant-id': tenant } : {}),
      },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Receipt failed');
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })
      .catch(() => setError('Could not open receipt PDF'));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.post('/payments', {
        student: form.student,
        amount: Number(form.amount),
        month: Number(form.month),
        year: Number(form.year),
        dueDate: form.dueDate,
        method: form.method,
      });
      setForm({
        student: '',
        amount: '',
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
        dueDate: endOfMonthIso(now.getFullYear(), now.getMonth() + 1),
        method: 'UPI',
      });
      setShowForm(false);
      setMessage('Fee record created');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create payment record');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">Collect fees, mark paid, and download receipts.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? 'Cancel' : 'Collect fee'}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Collected" value={`₹${summary.collected.toLocaleString('en-IN')}`} />
        <SummaryCard label="Pending" value={`₹${summary.pending.toLocaleString('en-IN')}`} />
        <SummaryCard label="Overdue" value={String(summary.overdue)} hint={`${summary.count} shown`} />
      </div>

      {error && <div className="rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}
      {message && <div className="rounded-md bg-[#eaf7ea] px-3 py-2 text-sm text-[#0ca30c]">{message}</div>}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3 lg:grid-cols-6"
        >
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Student</label>
            <select
              required
              value={form.student}
              onChange={(e) => onStudentPick(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Select...</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                  {s.monthlyFee != null ? ` · ₹${s.monthlyFee}` : ''}
                </option>
              ))}
            </select>
          </div>
          <Field label="Amount" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
          <Field
            label="Month"
            type="number"
            value={form.month}
            onChange={(v) => {
              const month = v;
              const year = Number(form.year) || now.getFullYear();
              setForm({
                ...form,
                month,
                dueDate: endOfMonthIso(year, Number(month) || 1),
              });
            }}
            required
          />
          <Field label="Year" type="number" value={form.year} onChange={(v) => setForm({ ...form, year: v })} required />
          <Field label="Due date" type="date" value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} required />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Method</label>
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-full">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Save fee record
            </button>
          </div>
        </form>
      )}

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
      </select>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Due date</th>
              <th className="px-4 py-2">Collect</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p._id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-900">{p.student?.name || 'Unknown'}</td>
                <td className="px-4 py-2">
                  {p.month}/{p.year}
                </td>
                <td className="px-4 py-2">₹{Number(p.amount || 0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      p.status === 'paid'
                        ? 'bg-emerald-50 text-emerald-700'
                        : p.status === 'overdue'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2">{new Date(p.dueDate).toLocaleDateString()}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.status !== 'paid' && (
                      <>
                        <select
                          value={payMethod[p._id] || 'UPI'}
                          onChange={(e) => setPayMethod({ ...payMethod, [p._id]: e.target.value })}
                          className="rounded-md border border-slate-200 px-1.5 py-1 text-xs"
                        >
                          {METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleMarkPaid(p._id)}
                          className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Mark paid
                        </button>
                      </>
                    )}
                    {p.status === 'paid' && (
                      <button
                        onClick={() => openReceipt(p._id)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Receipt PDF
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No payment records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
      />
    </div>
  );
}
