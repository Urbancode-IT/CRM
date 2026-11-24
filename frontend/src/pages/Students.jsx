import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../utils/format';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconButton, PencilIcon, TrashIcon } from '../components/icons';
import { toastError, toastSuccess } from '../utils/toast';

const FIELD_TYPES = ['text', 'number', 'email', 'phone', 'date', 'dropdown', 'textarea'];

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
  status: 'active',
  customValues: {},
};

const emptyFieldForm = { name: '', type: 'text', options: '', required: false };

function mapCustomValues(raw) {
  if (!raw) return {};
  if (raw instanceof Map) return Object.fromEntries(raw);
  return { ...raw };
}

export default function Students() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [studentsModuleId, setStudentsModuleId] = useState(null);
  const [extraFields, setExtraFields] = useState([]);
  const [showAddField, setShowAddField] = useState(false);
  const [fieldForm, setFieldForm] = useState(emptyFieldForm);
  const [fieldBusy, setFieldBusy] = useState(false);

  const canManageFields = user?.role === 'owner' || user?.role === 'admin';

  function load() {
    setLoadError('');
    setLoading(true);
    api
      .get('/students', { params: search ? { search } : {} })
      .then((res) => setStudents(res.data))
      .catch((err) => setLoadError(err.response?.data?.message || 'Failed to load students'))
      .finally(() => setLoading(false));
  }

  async function loadExtraFields() {
    try {
      const res = await api.get('/custom-modules');
      const studentsMod = (res.data.modules || []).find((m) => m.systemKey === 'students');
      if (!studentsMod) {
        setStudentsModuleId(null);
        setExtraFields([]);
        return;
      }
      setStudentsModuleId(studentsMod._id);
      const fieldsRes = await api.get(`/custom-modules/${studentsMod._id}/fields`);
      setExtraFields(fieldsRes.data.fields || []);
    } catch {
      // Extra fields are optional — keep core Students form working.
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    loadExtraFields();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, customValues: {} });
    setShowForm(true);
    setShowAddField(false);
    setFieldForm(emptyFieldForm);
    setError('');
  }

  function openEdit(student) {
    setEditingId(student._id);
    setForm({
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      parentName: student.parentName || '',
      parentEmail: student.parentEmail || '',
      parentPhone: student.parentPhone || '',
      subjects: (student.subjects || []).join(', '),
      grade: student.grade || '',
      batch: student.batch || '',
      monthlyFee: String(student.monthlyFee ?? ''),
      status: student.status || 'active',
      customValues: mapCustomValues(student.customValues),
    });
    setShowForm(true);
    setShowAddField(false);
    setFieldForm(emptyFieldForm);
    setError('');
  }

  function setCustomValue(key, value) {
    setForm((prev) => ({
      ...prev,
      customValues: { ...prev.customValues, [key]: value },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      subjects: form.subjects ? form.subjects.split(',').map((s) => s.trim()).filter(Boolean) : [],
      monthlyFee: Number(form.monthlyFee) || 0,
      customValues: form.customValues || {},
    };
    try {
      if (editingId) await api.put(`/students/${editingId}`, payload);
      else await api.post('/students', payload);
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      setShowAddField(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save student');
    }
  }

  async function handleAddField(e) {
    e.preventDefault();
    if (!studentsModuleId || !fieldForm.name.trim()) return;
    setFieldBusy(true);
    setError('');
    try {
      await api.post(`/custom-modules/${studentsModuleId}/fields`, {
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
    if (!studentsModuleId || !canManageFields) return;
    setFieldBusy(true);
    setError('');
    try {
      await api.delete(`/custom-modules/${studentsModuleId}/fields/${fieldId}`);
      await loadExtraFields();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete field');
    } finally {
      setFieldBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/students/${deleteId}`);
      if (editingId === deleteId) {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
        setShowAddField(false);
      }
      setDeleteId(null);
      toastSuccess('Moved to recycle bin');
      load();
    } catch (err) {
      const msg = err.response?.data?.message || 'Delete failed';
      setError(msg);
      toastError(msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Students</h1>
        <button
          onClick={() => (showForm ? (setShowForm(false), setEditingId(null), setShowAddField(false)) : openCreate())}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? 'Cancel' : 'Add student'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-2 gap-3 rounded-xl border border-brand-100 bg-white p-4 shadow-sm md:grid-cols-3"
        >
          {error && (
            <div className="col-span-full rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">
              {error}
            </div>
          )}
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
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
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
                    className="rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                  <select
                    value={fieldForm.type}
                    onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value })}
                    className="rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
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
                      className="rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
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
                      className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      {fieldBusy ? 'Saving...' : 'Save field'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddField(false);
                        setFieldForm(emptyFieldForm);
                      }}
                      className="rounded-md border border-brand-200 px-3 py-2 text-sm text-slate-600 hover:bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="col-span-full flex flex-wrap items-center gap-2">
            <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
              {editingId ? 'Update student' : 'Save student'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => setDeleteId(editingId)}
                className="rounded-md border border-[#f0c4c4] bg-[#fdeaea] px-3 py-2 text-sm font-medium text-[#d03b3b] hover:bg-[#f9d6d6]"
              >
                Delete student
              </button>
            )}
          </div>
        </form>
      )}

      <input
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-md border border-brand-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />

      {loadError && <div className="text-sm text-[#d03b3b]">{loadError}</div>}
      {loading && <div className="text-sm text-slate-500">Loading students...</div>}

      <div className="overflow-x-auto rounded-xl border border-brand-100 bg-white shadow-sm shadow-brand-900/5">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Grade</th>
              <th className="px-4 py-2">Batch</th>
              <th className="px-4 py-2">Subjects</th>
              <th className="px-4 py-2">Monthly fee</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s._id} className="border-t border-brand-50 hover:bg-brand-50/70">
                <td className="px-4 py-2">
                  <Link to={`/app/students/${s._id}`} className="font-medium text-slate-900 hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{s.grade || '-'}</td>
                <td className="px-4 py-2">{s.batch || '-'}</td>
                <td className="px-4 py-2">{(s.subjects || []).join(', ') || '-'}</td>
                <td className="px-4 py-2">{formatMoney(s.monthlyFee, user?.currencyLocale)}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      s.status === 'active' ? 'bg-[#eaf7ea] text-[#0ca30c]' : 'bg-brand-100 text-slate-500'
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    <IconButton label="Edit" onClick={() => openEdit(s)}>
                      <PencilIcon />
                    </IconButton>
                    <IconButton label="Delete" tone="danger" onClick={() => setDeleteId(s._id)}>
                      <TrashIcon />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && students.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Move to recycle bin"
        message="This student will move to Recycle Bin. You can restore later, or delete forever from there."
        confirmLabel="Move to bin"
        busy={deleting}
        onClose={() => {
          if (!deleting) setDeleteId(null);
        }}
        onConfirm={confirmDelete}
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
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          className={inputClass}
        />
      )}
    </div>
  );
}
