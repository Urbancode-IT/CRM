import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconButton, TrashIcon } from '../components/icons';
import { toastError, toastSuccess } from '../utils/toast';

const FIELD_TYPES = ['text', 'number', 'email', 'phone', 'date', 'dropdown', 'textarea'];

const ATT_STATUS = [
  { id: 'present', label: 'Present', active: 'bg-[#0ca30c] text-white', idle: 'bg-slate-100 text-slate-800' },
  { id: 'late', label: 'Late', active: 'bg-[#b8790f] text-white', idle: 'bg-slate-100 text-slate-800' },
  { id: 'absent', label: 'Absent', active: 'bg-[#d03b3b] text-white', idle: 'bg-slate-100 text-slate-800' },
  { id: 'holiday', label: 'Holiday', active: 'bg-[#4338ca] text-white', idle: 'bg-slate-100 text-slate-800' },
];

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  employeeCode: '',
  specialties: '',
  joinDate: '',
  address: '',
  emergencyName: '',
  emergencyPhone: '',
  monthlyPay: '',
  status: 'active',
  notes: '',
  batchIds: [],
  customValues: {},
};

const emptyFieldForm = { name: '', type: 'text', options: '', required: false };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function mapCustomValues(raw) {
  if (!raw) return {};
  if (raw instanceof Map) return Object.fromEntries(raw);
  return { ...raw };
}

export default function InstructorsPage() {
  const { user } = useAuth();
  const canManageFields = user?.role === 'owner' || user?.role === 'admin';

  const [instructors, setInstructors] = useState([]);
  const [batches, setBatches] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [instructorsModuleId, setInstructorsModuleId] = useState(null);
  const [extraFields, setExtraFields] = useState([]);
  const [showAddField, setShowAddField] = useState(false);
  const [fieldForm, setFieldForm] = useState(emptyFieldForm);
  const [fieldBusy, setFieldBusy] = useState(false);

  const [attDate, setAttDate] = useState(todayStr());
  const [attMarks, setAttMarks] = useState({});
  const [attSaving, setAttSaving] = useState(false);
  const [attMessage, setAttMessage] = useState('');

  async function load() {
    const res = await api.get('/instructors', {
      params: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      },
    });
    setInstructors(res.data.instructors || []);
  }

  async function loadBatches() {
    const res = await api.get('/batches');
    setBatches(res.data.batches || []);
  }

  async function loadExtraFields() {
    try {
      const res = await api.get('/custom-modules');
      const mod = (res.data.modules || []).find((m) => m.systemKey === 'instructors');
      if (!mod) {
        setInstructorsModuleId(null);
        setExtraFields([]);
        return;
      }
      setInstructorsModuleId(mod._id);
      const fieldsRes = await api.get(`/custom-modules/${mod._id}/fields`);
      setExtraFields(fieldsRes.data.fields || []);
    } catch {
      /* optional */
    }
  }

  async function loadAttendance() {
    const res = await api.get('/instructors/attendance', { params: { date: attDate } });
    const map = {};
    (res.data || []).forEach((a) => {
      map[a.instructor?._id || a.instructor] = a.status;
    });
    setAttMarks(map);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      load().catch((err) => setError(err.response?.data?.message || 'Failed to load instructors'));
    }, 200);
    return () => clearTimeout(t);
  }, [statusFilter, search]);

  useEffect(() => {
    loadBatches().catch(() => {});
    loadExtraFields();
  }, []);

  useEffect(() => {
    loadAttendance().catch(() => setAttMarks({}));
  }, [attDate]);

  const visible = useMemo(() => instructors, [instructors]);
  const activeInstructors = useMemo(
    () => instructors.filter((i) => i.status === 'active'),
    [instructors]
  );

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, customValues: {}, batchIds: [] });
    setShowForm(true);
    setShowAddField(false);
    setError('');
    setMessage('');
  }

  function openEdit(inst) {
    setEditingId(inst._id);
    setForm({
      name: inst.name || '',
      email: inst.email || '',
      phone: inst.phone || '',
      employeeCode: inst.employeeCode || '',
      specialties: (inst.specialties || []).join(', '),
      joinDate: inst.joinDate ? String(inst.joinDate).slice(0, 10) : '',
      address: inst.address || '',
      emergencyName: inst.emergencyName || '',
      emergencyPhone: inst.emergencyPhone || '',
      monthlyPay: String(inst.monthlyPay ?? ''),
      status: inst.status || 'active',
      notes: inst.notes || '',
      batchIds: (inst.batchIds || []).map(String),
      customValues: mapCustomValues(inst.customValues),
    });
    setShowForm(true);
    setShowAddField(false);
    setError('');
    setMessage('');
  }

  function toggleBatch(id) {
    const key = String(id);
    setForm((prev) => {
      const has = prev.batchIds.includes(key);
      return {
        ...prev,
        batchIds: has ? prev.batchIds.filter((b) => b !== key) : [...prev.batchIds, key],
      };
    });
  }

  function setCustomValue(key, value) {
    setForm((prev) => ({
      ...prev,
      customValues: { ...prev.customValues, [key]: value },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        ...form,
        specialties: form.specialties,
        monthlyPay: Number(form.monthlyPay) || 0,
        joinDate: form.joinDate || undefined,
        batchIds: form.batchIds,
        customValues: form.customValues || {},
      };
      if (editingId) {
        await api.put(`/instructors/${editingId}`, payload);
        toastSuccess('Instructor updated');
      } else {
        await api.post('/instructors', payload);
        toastSuccess('Instructor added');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await load();
      await loadBatches();
    } catch (err) {
      const msg = err.response?.data?.message || 'Save failed';
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteInstructor() {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/instructors/${confirmDelete.id}`);
      toastSuccess('Instructor deleted');
      if (editingId === confirmDelete.id) {
        setShowForm(false);
        setEditingId(null);
      }
      setConfirmDelete(null);
      await load();
    } catch (err) {
      const msg = err.response?.data?.message || 'Delete failed';
      setError(msg);
      toastError(msg);
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddField(e) {
    e.preventDefault();
    if (!instructorsModuleId || !fieldForm.name.trim()) return;
    setFieldBusy(true);
    setError('');
    try {
      await api.post(`/custom-modules/${instructorsModuleId}/fields`, {
        name: fieldForm.name.trim(),
        type: fieldForm.type,
        required: fieldForm.required,
        options:
          fieldForm.type === 'dropdown'
            ? fieldForm.options.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
      });
      setFieldForm(emptyFieldForm);
      setShowAddField(false);
      await loadExtraFields();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add field');
    } finally {
      setFieldBusy(false);
    }
  }

  async function handleDeleteField(fieldId) {
    if (!instructorsModuleId || !canManageFields) return;
    setFieldBusy(true);
    try {
      await api.delete(`/custom-modules/${instructorsModuleId}/fields/${fieldId}`);
      await loadExtraFields();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove field');
    } finally {
      setFieldBusy(false);
    }
  }

  function setAttMark(id, status) {
    setAttMarks((prev) => ({ ...prev, [id]: status }));
  }

  function markAllAtt(status) {
    const next = {};
    activeInstructors.forEach((i) => {
      next[i._id] = status;
    });
    setAttMarks(next);
  }

  async function saveAttendance() {
    setAttSaving(true);
    setAttMessage('');
    try {
      const entries = activeInstructors.map((i) => ({
        instructor: i._id,
        status: attMarks[i._id] || 'present',
      }));
      await api.post('/instructors/attendance/mark-bulk', { date: attDate, entries });
      setAttMessage(`Attendance saved for ${entries.length} instructor(s).`);
    } catch (err) {
      setAttMessage(err.response?.data?.message || 'Failed to save attendance');
    } finally {
      setAttSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Instructors</h1>
            <p className="text-sm text-slate-500">
              Add coaches, assign batches, mark attendance. For login access: set the same email here,
              then invite them as role <span className="font-medium text-slate-700">Instructor</span> from Account → Team.
            </p>
          </div>
          <button
            type="button"
            onClick={() => (showForm ? (setShowForm(false), setEditingId(null)) : openCreate())}
            className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {showForm ? 'Cancel' : 'Add instructor'}
          </button>
        </div>

        {error && <div className="rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}
        {message && <div className="text-sm text-slate-600">{message}</div>}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="grid gap-3 rounded-xl border border-brand-100 bg-white p-4 shadow-sm md:grid-cols-2"
          >
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field
              label="Employee / staff code"
              value={form.employeeCode}
              onChange={(v) => setForm({ ...form, employeeCode: v })}
            />
            <Field
              label="Specialties (comma separated)"
              value={form.specialties}
              onChange={(v) => setForm({ ...form, specialties: v })}
            />
            <Field
              label="Join date"
              type="date"
              value={form.joinDate}
              onChange={(v) => setForm({ ...form, joinDate: v })}
            />
            <Field
              label="Monthly pay"
              type="number"
              value={form.monthlyPay}
              onChange={(v) => setForm({ ...form, monthlyPay: v })}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
            <Field
              label="Emergency contact name"
              value={form.emergencyName}
              onChange={(v) => setForm({ ...form, emergencyName: v })}
            />
            <Field
              label="Emergency phone"
              value={form.emergencyPhone}
              onChange={(v) => setForm({ ...form, emergencyPhone: v })}
            />
            <div className="md:col-span-2">
              <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assign batches
              </p>
              {batches.length === 0 ? (
                <p className="text-sm text-slate-500">No batches yet — create them on the Batches page.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {batches.map((b) => {
                    const id = String(b._id);
                    const selected = form.batchIds.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleBatch(id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          selected
                            ? 'bg-brand-600 text-white'
                            : 'bg-white text-slate-700 ring-1 ring-brand-200 hover:bg-brand-50'
                        }`}
                      >
                        {b.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {extraFields.map((f) => (
              <CustomFieldInput
                key={f._id}
                field={f}
                value={form.customValues?.[f.key] ?? ''}
                onChange={(v) => setCustomValue(f.key, v)}
                onDelete={canManageFields ? () => handleDeleteField(f._id) : undefined}
                busy={fieldBusy}
              />
            ))}

            {canManageFields && (
              <div className="col-span-full space-y-2 border-t border-brand-50 pt-3">
                {!showAddField ? (
                  <button
                    type="button"
                    onClick={() => setShowAddField(true)}
                    className="rounded-md border border-brand-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-brand-50"
                  >
                    + Add field
                  </button>
                ) : (
                  <div className="grid gap-2 rounded-lg border border-dashed border-brand-200 bg-brand-50/40 p-3 md:grid-cols-4">
                    <input
                      required
                      placeholder="Field name"
                      value={fieldForm.name}
                      onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                      className="rounded-md border border-brand-200 px-3 py-2 text-sm"
                    />
                    <select
                      value={fieldForm.type}
                      onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value })}
                      className="rounded-md border border-brand-200 px-3 py-2 text-sm"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    {fieldForm.type === 'dropdown' ? (
                      <input
                        placeholder="Options (comma separated)"
                        value={fieldForm.options}
                        onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })}
                        className="rounded-md border border-brand-200 px-3 py-2 text-sm"
                      />
                    ) : (
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={fieldForm.required}
                          onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })}
                        />
                        Required
                      </label>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={fieldBusy}
                        onClick={handleAddField}
                        className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {fieldBusy ? 'Saving...' : 'Save field'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddField(false);
                          setFieldForm(emptyFieldForm);
                        }}
                        className="rounded-md border border-brand-200 px-3 py-2 text-sm text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingId ? 'Update instructor' : 'Save instructor'}
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-brand-200 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-brand-100 bg-white shadow-sm">
          <table className="w-full min-w-[720px] table-fixed text-sm">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[18%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="bg-brand-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-left font-medium">Contact</th>
                <th className="px-4 py-2.5 text-left font-medium">Specialties</th>
                <th className="px-4 py-2.5 text-left font-medium">Batches</th>
                <th className="px-2 py-2.5 text-center font-medium">Status</th>
                <th className="px-2 py-2.5 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i._id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 align-middle">
                    <div className="font-medium text-slate-900">{i.name}</div>
                    {i.employeeCode ? (
                      <div className="text-xs text-slate-400">{i.employeeCode}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 align-middle text-slate-600">
                    <div>{i.phone || '—'}</div>
                    <div className="text-xs text-slate-400">{i.email || ''}</div>
                  </td>
                  <td className="px-4 py-2.5 align-middle text-slate-600">
                    {(i.specialties || []).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2.5 align-middle text-slate-600">
                    {(i.batches || []).map((b) => b.name).join(', ') || '—'}
                  </td>
                  <td className="px-2 py-2.5 text-center align-middle">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        i.status === 'active'
                          ? 'bg-[#eaf7ea] text-[#0ca30c]'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {i.status}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-center align-middle">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(i)}
                        className="text-xs font-medium text-slate-700 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ id: i._id, name: i.name })}
                        className="text-xs font-medium text-[#d03b3b] hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No instructors yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Instructor attendance</h2>
            <p className="text-xs text-slate-500">Mark present / late / absent for active instructors.</p>
          </div>
          <input
            type="date"
            value={attDate}
            onChange={(e) => setAttDate(e.target.value)}
            className="rounded-md border border-brand-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => markAllAtt('present')}
            disabled={!activeInstructors.length}
            className="rounded-md border border-[#0ca30c]/30 bg-[#eaf7ea] px-3 py-1.5 text-xs font-medium text-[#0ca30c] disabled:opacity-50"
          >
            Mark all Present
          </button>
          <button
            type="button"
            onClick={() => markAllAtt('holiday')}
            disabled={!activeInstructors.length}
            className="rounded-md border border-[#4338ca]/30 bg-[#eef2ff] px-3 py-1.5 text-xs font-medium text-[#4338ca] disabled:opacity-50"
          >
            Mark day Holiday
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-brand-100 bg-white shadow-sm">
          <table className="w-full min-w-[520px] table-fixed text-sm">
            <colgroup>
              <col className="w-[35%]" />
              <col className="w-[65%]" />
            </colgroup>
            <thead className="bg-brand-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Instructor</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeInstructors.map((i) => {
                const current = attMarks[i._id] || 'present';
                return (
                  <tr key={i._id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 align-middle font-medium text-slate-900">{i.name}</td>
                    <td className="px-4 py-2.5 align-middle">
                      <div className="flex flex-wrap gap-2">
                        {ATT_STATUS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setAttMark(i._id, opt.id)}
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              current === opt.id ? opt.active : opt.idle
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {activeInstructors.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-slate-500">
                    No active instructors to mark.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveAttendance}
            disabled={attSaving || !activeInstructors.length}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {attSaving ? 'Saving...' : 'Save instructor attendance'}
          </button>
          {attMessage && <span className="text-sm text-slate-600">{attMessage}</span>}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete instructor"
        message={`Delete “${confirmDelete?.name || ''}”? Batches will be unassigned.`}
        confirmLabel="Delete"
        busy={deleting}
        onClose={() => {
          if (!deleting) setConfirmDelete(null);
        }}
        onConfirm={confirmDeleteInstructor}
      />
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
        className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
    </div>
  );
}

function CustomFieldInput({ field, value, onChange, onDelete, busy }) {
  const inputClass =
    'w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-xs font-medium text-slate-600">
          {field.name}
          {field.required ? ' *' : ''}
        </label>
        {onDelete ? (
          <IconButton label="Remove field" tone="danger" disabled={busy} onClick={onDelete} className="h-6 w-6">
            <TrashIcon className="h-3.5 w-3.5" />
          </IconButton>
        ) : null}
      </div>
      {field.type === 'textarea' ? (
        <textarea
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className={inputClass}
        />
      ) : field.type === 'dropdown' ? (
        <select
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Select</option>
          {(field.options || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={
            field.type === 'number'
              ? 'number'
              : field.type === 'date'
                ? 'date'
                : field.type === 'email'
                  ? 'email'
                  : 'text'
          }
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
    </div>
  );
}
