import { useEffect, useState } from 'react';
import api from '../services/api';

const emptyForm = {
  title: '',
  description: '',
  relatedStudent: '',
  assignedTo: 'Tutor',
  dueDate: '',
  priority: 'medium',
  recurring: false,
  recurrencePattern: 'weekly',
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [students, setStudents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  function load() {
    api.get('/tasks', { params: statusFilter ? { status: statusFilter } : {} }).then((res) => setTasks(res.data));
  }

  useEffect(load, [statusFilter]);
  useEffect(() => {
    api.get('/students', { params: { status: 'active' } }).then((res) => setStudents(res.data));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/tasks', {
        ...form,
        relatedStudent: form.relatedStudent || undefined,
        recurrencePattern: form.recurring ? form.recurrencePattern : null,
      });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create task');
    }
  }

  async function updateStatus(id, status) {
    await api.put(`/tasks/${id}`, { status });
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Tasks</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? 'Cancel' : 'Add task'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
          {error && <div className="col-span-full rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}
          <div className="col-span-full">
            <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="col-span-full">
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Related student (optional)</label>
            <select
              value={form.relatedStudent}
              onChange={(e) => setForm({ ...form, relatedStudent: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">General task</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Due date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="recurring"
              checked={form.recurring}
              onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
            />
            <label htmlFor="recurring" className="text-sm text-slate-600">Recurring template</label>
          </div>
          {form.recurring && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Repeats</label>
              <select
                value={form.recurrencePattern}
                onChange={(e) => setForm({ ...form, recurrencePattern: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          )}
          <div className="col-span-full">
            <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              Save task
            </button>
          </div>
        </form>
      )}

      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="in_progress">In progress</option>
        <option value="completed">Completed</option>
      </select>

      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <div key={t._id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{t.title}</span>
                {t.recurring && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">recurring template</span>}
                {t.autoGenerated && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">auto-generated</span>}
              </div>
              <p className="text-xs text-slate-500">
                {t.relatedStudent?.name ? `${t.relatedStudent.name} · ` : ''}
                {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No due date'} · {t.priority} priority
              </p>
              {t.description && <p className="mt-1 text-sm text-slate-600">{t.description}</p>}
            </div>
            <select
              value={t.status}
              onChange={(e) => updateStatus(t._id, e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-sm text-slate-500">No tasks yet.</p>}
      </div>
    </div>
  );
}
