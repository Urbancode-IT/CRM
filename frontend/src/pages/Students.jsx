import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  parentName: '',
  parentEmail: '',
  parentPhone: '',
  subjects: '',
  grade: '',
  batch: '',
  monthlyFee: '',
};

export default function Students() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  function load() {
    api.get('/students', { params: search ? { search } : {} }).then((res) => setStudents(res.data));
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/students', {
        ...form,
        subjects: form.subjects ? form.subjects.split(',').map((s) => s.trim()) : [],
        monthlyFee: Number(form.monthlyFee) || 0,
      });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create student');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Students</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? 'Cancel' : 'Add student'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
          {error && <div className="col-span-full rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}
          <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="Student email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Parent name" value={form.parentName} onChange={(v) => setForm({ ...form, parentName: v })} />
          <Field label="Parent email" value={form.parentEmail} onChange={(v) => setForm({ ...form, parentEmail: v })} />
          <Field label="Parent phone" value={form.parentPhone} onChange={(v) => setForm({ ...form, parentPhone: v })} />
          <Field label="Subjects (comma separated)" value={form.subjects} onChange={(v) => setForm({ ...form, subjects: v })} />
          <Field label="Grade / level" value={form.grade} onChange={(v) => setForm({ ...form, grade: v })} />
          <Field label="Batch" value={form.batch} onChange={(v) => setForm({ ...form, batch: v })} />
          <Field label="Monthly fee" type="number" value={form.monthlyFee} onChange={(v) => setForm({ ...form, monthlyFee: v })} required />
          <div className="col-span-full">
            <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Save student
            </button>
          </div>
        </form>
      )}

      <input
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Grade</th>
              <th className="px-4 py-2">Batch</th>
              <th className="px-4 py-2">Subjects</th>
              <th className="px-4 py-2">Monthly fee</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s._id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link to={`/students/${s._id}`} className="font-medium text-brand-700 hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{s.grade || '-'}</td>
                <td className="px-4 py-2">{s.batch || '-'}</td>
                <td className="px-4 py-2">{(s.subjects || []).join(', ') || '-'}</td>
                <td className="px-4 py-2">{s.monthlyFee}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      s.status === 'active' ? 'bg-[#eaf7ea] text-[#0ca30c]' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No students found.
                </td>
              </tr>
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
