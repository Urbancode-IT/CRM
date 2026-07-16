import { useEffect, useState } from 'react';
import api from '../services/api';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [status, setStatus] = useState('');
  const [students, setStudents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ student: '', amount: '', month: '', year: '', dueDate: '' });
  const [error, setError] = useState('');

  function load() {
    api.get('/payments', { params: status ? { status } : {} }).then((res) => setPayments(res.data));
  }

  useEffect(load, [status]);
  useEffect(() => {
    api.get('/students', { params: { status: 'active' } }).then((res) => setStudents(res.data));
  }, []);

  async function handleMarkPaid(id) {
    await api.patch(`/payments/${id}/mark-paid`, {});
    load();
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/payments', {
        ...form,
        amount: Number(form.amount),
        month: Number(form.month),
        year: Number(form.year),
      });
      setForm({ student: '', amount: '', month: '', year: '', dueDate: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create payment record');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Payments</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? 'Cancel' : 'Add payment record'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
          {error && <div className="col-span-full rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Student</label>
            <select
              required
              value={form.student}
              onChange={(e) => setForm({ ...form, student: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select...</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <Field label="Amount" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required />
          <Field label="Month (1-12)" type="number" value={form.month} onChange={(v) => setForm({ ...form, month: v })} required />
          <Field label="Year" type="number" value={form.year} onChange={(v) => setForm({ ...form, year: v })} required />
          <Field label="Due date" type="date" value={form.dueDate} onChange={(v) => setForm({ ...form, dueDate: v })} required />
          <div className="col-span-full">
            <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Save payment record
            </button>
          </div>
        </form>
      )}

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
      </select>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Due date</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p._id} className="border-t border-slate-100">
                <td className="px-4 py-2">{p.student?.name || 'Unknown'}</td>
                <td className="px-4 py-2">{p.month}/{p.year}</td>
                <td className="px-4 py-2">{p.amount}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      p.status === 'paid'
                        ? 'bg-[#eaf7ea] text-[#0ca30c]'
                        : p.status === 'overdue'
                        ? 'bg-[#fdeaea] text-[#d03b3b]'
                        : 'bg-[#fff6e5] text-[#b8790f]'
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2">{new Date(p.dueDate).toLocaleDateString()}</td>
                <td className="px-4 py-2">
                  {p.status !== 'paid' && (
                    <button
                      onClick={() => handleMarkPaid(p._id)}
                      className="rounded-md border border-brand-200 px-2 py-1 text-xs text-brand-700 hover:bg-brand-50"
                    >
                      Mark paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No payment records.</td></tr>
            )}
          </tbody>
        </table>
      </div>
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
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
    </div>
  );
}
