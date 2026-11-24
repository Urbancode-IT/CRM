import { useEffect, useMemo, useState } from 'react';
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
  applyScope: 'one', // one | batch | all
  batch: '',
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [students, setStudents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    api.get('/tasks', { params: statusFilter ? { status: statusFilter } : {} }).then((res) => setTasks(res.data));
  }

  useEffect(load, [statusFilter]);
  useEffect(() => {
    api.get('/students', { params: { status: 'active' } }).then((res) => setStudents(res.data));
  }, []);

  const batches = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      if (s.batch?.trim()) set.add(s.batch.trim());
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [students]);

  const batchStudentCount = useMemo(() => {
    if (form.applyScope === 'all') return students.length;
    if (form.applyScope === 'batch' && form.batch) {
      return students.filter((s) => (s.batch || '').trim() === form.batch).length;
    }
    return 1;
  }, [form.applyScope, form.batch, students]);

  const formStudents = useMemo(() => {
    if (form.applyScope === 'batch' && form.batch) {
      return students.filter((s) => (s.batch || '').trim() === form.batch);
    }
    return students;
  }, [students, form.applyScope, form.batch]);

  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      const studentBatch = (t.relatedStudent?.batch || '').trim();
      if (batchFilter !== 'all') {
        if (batchFilter === '__none__') {
          if (t.relatedStudent && studentBatch) return false;
        } else if (studentBatch !== batchFilter) {
          return false;
        }
      }
      if (q) {
        const hay = `${t.title || ''} ${t.relatedStudent?.name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, batchFilter, search]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        assignedTo: form.assignedTo,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
        recurring: form.recurring,
        recurrencePattern: form.recurring ? form.recurrencePattern : null,
      };

      if (form.applyScope === 'batch') {
        if (!form.batch) {
          setError('Select a batch to create tasks for.');
          return;
        }
        const res = await api.post('/tasks/batch', { ...payload, batch: form.batch });
        setMessage(`Created ${res.data.created} task(s) for batch "${form.batch}".`);
      } else if (form.applyScope === 'all') {
        const res = await api.post('/tasks/batch', { ...payload, allActive: true });
        setMessage(`Created ${res.data.created} task(s) for all active students.`);
      } else {
        await api.post('/tasks', {
          ...payload,
          relatedStudent: form.relatedStudent || undefined,
        });
        setMessage('Task saved.');
      }

      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id, status) {
    await api.put(`/tasks/${id}`, { status });
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Tasks</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Large class tip: create one task for a whole batch, then filter by batch to track.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setError('');
            setMessage('');
          }}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? 'Cancel' : 'Add task'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-2 gap-3 rounded-xl border border-brand-100 bg-white p-4 shadow-sm md:grid-cols-3"
        >
          {error && (
            <div className="col-span-full rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">
              {error}
            </div>
          )}
          <div className="col-span-full">
            <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="col-span-full">
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          <div className="col-span-full md:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Apply to</label>
            <select
              value={form.applyScope}
              onChange={(e) =>
                setForm({
                  ...form,
                  applyScope: e.target.value,
                  relatedStudent: '',
                  batch: e.target.value === 'batch' ? form.batch || batches[0] || '' : '',
                })
              }
              className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
            >
              <option value="one">One student / general</option>
              <option value="batch">Whole batch</option>
              <option value="all">All active students</option>
            </select>
          </div>

          {form.applyScope === 'one' && (
            <div className="col-span-full md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Related student (optional)
              </label>
              <select
                value={form.relatedStudent}
                onChange={(e) => setForm({ ...form, relatedStudent: e.target.value })}
                className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
              >
                <option value="">General task</option>
                {students.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                    {s.batch ? ` · ${s.batch}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.applyScope === 'batch' && (
            <div className="col-span-full md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Batch</label>
              <select
                value={form.batch}
                onChange={(e) => setForm({ ...form, batch: e.target.value })}
                className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
                required
              >
                <option value="">Select batch</option>
                {batches.map((b) => (
                  <option key={b} value={b}>
                    {b} ({students.filter((s) => (s.batch || '').trim() === b).length})
                  </option>
                ))}
              </select>
              {form.batch ? (
                <p className="mt-1 text-xs text-slate-500">
                  Will create {batchStudentCount} task(s) — one per student in this batch.
                  {formStudents.length > 0 && (
                    <span className="mt-0.5 block truncate">
                      {formStudents
                        .slice(0, 4)
                        .map((s) => s.name)
                        .join(', ')}
                      {formStudents.length > 4 ? ` +${formStudents.length - 4} more` : ''}
                    </span>
                  )}
                </p>
              ) : null}
            </div>
          )}

          {form.applyScope === 'all' && (
            <div className="col-span-full md:col-span-2 flex items-end">
              <p className="text-xs text-slate-500">
                Will create {batchStudentCount} task(s) — one per active student.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
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
              className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="recurring"
              checked={form.recurring}
              onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
            />
            <label htmlFor="recurring" className="text-sm text-slate-600">
              Recurring template
            </label>
          </div>
          {form.recurring && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Repeats</label>
              <select
                value={form.recurrencePattern}
                onChange={(e) => setForm({ ...form, recurrencePattern: e.target.value })}
                className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          )}
          <div className="col-span-full">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving
                ? 'Saving...'
                : form.applyScope === 'one'
                  ? 'Save task'
                  : `Create ${batchStudentCount} task${batchStudentCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      )}

      {message && !showForm && <p className="text-sm text-slate-600">{message}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-brand-200 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Batch</label>
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="rounded-md border border-brand-200 px-3 py-2 text-sm"
          >
            <option value="all">All batches</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
            <option value="__none__">No batch / general</option>
          </select>
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or student..."
            className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          Showing <span className="font-semibold text-slate-900">{visibleTasks.length}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {visibleTasks.map((t) => (
          <div
            key={t._id}
            className="flex items-center justify-between rounded-xl border border-brand-100 bg-white p-4 shadow-sm"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-900">{t.title}</span>
                {t.recurring && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-slate-700">
                    recurring template
                  </span>
                )}
                {t.autoGenerated && (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-slate-500">
                    auto-generated
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {t.relatedStudent?.name ? `${t.relatedStudent.name}` : 'General'}
                {t.relatedStudent?.batch ? ` · ${t.relatedStudent.batch}` : ''}
                {' · '}
                {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No due date'} · {t.priority}{' '}
                priority
              </p>
              {t.description && <p className="mt-1 text-sm text-slate-600">{t.description}</p>}
            </div>
            <select
              value={t.status}
              onChange={(e) => updateStatus(t._id, e.target.value)}
              className="rounded-md border border-brand-200 px-2 py-1 text-xs"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        ))}
        {visibleTasks.length === 0 && (
          <p className="text-sm text-slate-500">
            {tasks.length === 0 ? 'No tasks yet.' : 'No tasks in this batch / search.'}
          </p>
        )}
      </div>
    </div>
  );
}
