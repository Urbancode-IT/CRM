import { useEffect, useState } from 'react';
import api from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import { toastError, toastSuccess } from '../utils/toast';

const DAYS = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
];

const emptyForm = {
  name: '',
  grade: '',
  subjects: '',
  capacity: 30,
  instructor: '',
  day: 'mon',
  startTime: '17:00',
  endTime: '18:00',
  subject: '',
};

export default function BatchesPage() {
  const [batches, setBatches] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const [b, t, i] = await Promise.all([
      api.get('/batches'),
      api.get('/batches/timetable'),
      api.get('/instructors', { params: { status: 'active' } }),
    ]);
    setBatches(b.data.batches || []);
    setTimetable(t.data.timetable || []);
    setInstructors(i.data.instructors || []);
  }

  useEffect(() => {
    load().catch((err) => toastError(err.response?.data?.message || 'Failed to load batches'));
  }, []);

  async function createBatch(e) {
    e.preventDefault();
    try {
      await api.post('/batches', {
        name: form.name,
        grade: form.grade,
        capacity: Number(form.capacity) || 30,
        instructor: form.instructor || null,
        subjects: form.subjects
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        schedule: [
          {
            day: form.day,
            startTime: form.startTime,
            endTime: form.endTime,
            subject: form.subject || form.name,
          },
        ],
      });
      setForm(emptyForm);
      toastSuccess('Batch created');
      await load();
    } catch (err) {
      toastError(err.response?.data?.message || 'Could not create batch');
    }
  }

  async function assignInstructor(batchId, instructorId) {
    try {
      await api.patch(`/batches/${batchId}`, { instructor: instructorId || null });
      toastSuccess('Instructor assigned');
      await load();
    } catch (err) {
      toastError(err.response?.data?.message || 'Could not assign instructor');
    }
  }

  async function confirmRemoveBatch() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/batches/${confirmDelete._id}`);
      toastSuccess('Batch deleted');
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toastError(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Batches & timetable</h1>
        <p className="text-sm text-slate-500">Class slots by day — assign students later from student profile.</p>
      </div>

      <form onSubmit={createBatch} className="grid gap-3 rounded-xl border border-brand-100 bg-white p-4 shadow-sm md:grid-cols-3">
        <input
          required
          placeholder="Batch name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
        <input
          placeholder="Grade"
          value={form.grade}
          onChange={(e) => setForm({ ...form, grade: e.target.value })}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
        <input
          placeholder="Subjects (comma separated)"
          value={form.subjects}
          onChange={(e) => setForm({ ...form, subjects: e.target.value })}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
        <select
          value={form.instructor}
          onChange={(e) => setForm({ ...form, instructor: e.target.value })}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        >
          <option value="">No instructor</option>
          {instructors.map((i) => (
            <option key={i._id} value={i._id}>
              {i.name}
            </option>
          ))}
        </select>
        <select
          value={form.day}
          onChange={(e) => setForm({ ...form, day: e.target.value })}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        >
          {DAYS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={form.startTime}
          onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
        <input
          type="time"
          value={form.endTime}
          onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700 md:col-span-3">
          Add batch
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-brand-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Batches</div>
          <ul className="divide-y divide-slate-100">
            {batches.map((b) => (
              <li key={b._id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{b.name}</p>
                  <p className="text-xs text-slate-500">
                    {b.grade || '—'} · {b.studentCount || 0} students · cap {b.capacity}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {(b.schedule || []).map((s) => `${s.day} ${s.startTime}-${s.endTime}`).join(' · ') || 'No slots'}
                  </p>
                  <select
                    value={b.instructor?._id || b.instructor || ''}
                    onChange={(e) => assignInstructor(b._id, e.target.value)}
                    className="mt-2 w-full max-w-xs rounded-md border border-brand-200 px-2 py-1 text-xs"
                  >
                    <option value="">No instructor</option>
                    {instructors.map((i) => (
                      <option key={i._id} value={i._id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(b)}
                  className="text-xs text-[#d03b3b]"
                >
                  Delete
                </button>
              </li>
            ))}
            {batches.length === 0 && <li className="px-4 py-6 text-center text-slate-500">No batches yet</li>}
          </ul>
        </section>

        <section className="overflow-hidden rounded-xl border border-brand-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Weekly timetable</div>
          <div className="space-y-3 p-4">
            {timetable.map((day) => (
              <div key={day.day}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{day.day}</p>
                {day.slots.length === 0 ? (
                  <p className="text-sm text-slate-400">—</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {day.slots.map((s, i) => (
                      <li key={`${day.day}-${i}`} className="rounded-md bg-brand-50 px-2 py-1 text-sm text-slate-700">
                        {s.startTime}–{s.endTime} · {s.batchName}
                        {s.subject ? ` · ${s.subject}` : ''}
                        {s.instructorName ? ` · ${s.instructorName}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete batch"
        message={`Delete “${confirmDelete?.name || 'this batch'}”? Students will be unassigned from it.`}
        confirmLabel="Delete"
        busy={deleting}
        onClose={() => {
          if (!deleting) setConfirmDelete(null);
        }}
        onConfirm={confirmRemoveBatch}
      />
    </div>
  );
}
