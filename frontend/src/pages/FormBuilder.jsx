import { useEffect, useState } from 'react';
import api from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconButton, TrashIcon } from '../components/icons';

const FIELD_TYPES = [
  'text',
  'number',
  'email',
  'phone',
  'date',
  'dropdown',
  'checkbox',
  'radio',
  'textarea',
];

const emptyField = (overrides = {}) => ({
  id: crypto.randomUUID(),
  name: 'New field',
  key: `field_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  type: 'text',
  required: false,
  placeholder: '',
  options: [],
  order: 0,
  ...overrides,
});

export default function FormBuilder() {
  const [forms, setForms] = useState([]);
  const [templates, setTemplates] = useState({ builtIn: [], saved: [] });
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(false);
  const [values, setValues] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [creating, setCreating] = useState(false);

  async function loadForms() {
    const res = await api.get('/forms', { params: { templates: '0' } });
    const list = res.data.forms || [];
    setForms(list);
    return list;
  }

  async function loadTemplates() {
    const res = await api.get('/forms/templates');
    setTemplates({
      builtIn: res.data.builtIn || [],
      saved: res.data.saved || [],
    });
  }

  useEffect(() => {
    Promise.all([loadForms(), loadTemplates()])
      .then(([list]) => {
        if (list.length && !selected) setSelected(list[0]);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load forms'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNewForm() {
    setShowTemplates(true);
    setError('');
    setMessage('');
    loadTemplates().catch(() => {});
  }

  async function createFromTemplate(tpl) {
    setCreating(true);
    setError('');
    try {
      const res = await api.post('/forms/from-template', {
        templateId: tpl.id,
        source: tpl.source || 'built_in',
        name: tpl.name === 'Blank form' ? 'Untitled form' : tpl.name,
      });
      setShowTemplates(false);
      const list = await loadForms();
      setSelected(res.data.form || list[0] || null);
      setPreview(false);
      const count = res.data.form?.fields?.length || tpl.fieldCount || 0;
      setMessage(
        count
          ? `Created “${res.data.form.name}” from template (${count} fields) — edit and Save.`
          : 'Blank form created — add fields below.'
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create form');
    } finally {
      setCreating(false);
    }
  }

  function applyTemplateFields(tpl) {
    if (!selected) return;
    const fields = (tpl.fields || []).map((f, i) =>
      emptyField({
        name: f.name,
        key: f.key || f.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        type: f.type || 'text',
        required: Boolean(f.required),
        placeholder: f.placeholder || '',
        options: f.options || [],
        order: i,
      })
    );
    setSelected((prev) => ({
      ...prev,
      name: prev.name === 'Untitled form' || !prev.name ? tpl.name : prev.name,
      fields,
    }));
    setMessage(`Loaded “${tpl.name}” fields — click Save to keep them.`);
  }

  async function confirmDeleteForm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/forms/${deleteTarget._id}`);
      const list = await loadForms();
      if (selected?._id === deleteTarget._id) {
        setSelected(list[0] || null);
        setPreview(false);
      }
      setDeleteTarget(null);
      setMessage('Form deleted');
      await loadTemplates();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  async function saveForm() {
    if (!selected) return;
    const res = await api.patch(`/forms/${selected._id}`, {
      name: selected.name,
      description: selected.description,
      fields: selected.fields,
      status: selected.status,
      allowPublic: Boolean(selected.allowPublic),
    });
    setSelected(res.data.form);
    setMessage('Form saved');
    await loadForms();
  }

  async function saveAsTemplate() {
    if (!selected) return;
    try {
      await api.post(`/forms/${selected._id}/save-as-template`, {
        name: `${selected.name} template`,
      });
      await loadTemplates();
      setMessage(`“${selected.name}” saved as a template — use New form to reuse it.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save template');
    }
  }

  function updateField(id, patch) {
    setSelected((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === id || f._id === id ? { ...f, ...patch } : f)),
    }));
  }

  function addField() {
    setSelected((prev) => ({
      ...prev,
      fields: [...(prev.fields || []), { ...emptyField(), order: (prev.fields || []).length }],
    }));
  }

  function moveField(from, to) {
    setSelected((prev) => {
      const next = [...(prev.fields || [])];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...prev, fields: next.map((f, i) => ({ ...f, order: i })) };
    });
  }

  async function submitPreview(e) {
    e.preventDefault();
    try {
      await api.post(`/forms/${selected._id}/submit`, { values, preview: true });
      setMessage('Submission saved as a record');
      setValues({});
    } catch (err) {
      setError(err.response?.data?.message || 'Submit failed');
    }
  }

  const allTemplates = [...(templates.builtIn || []), ...(templates.saved || [])];
  const fieldTemplates = allTemplates.filter((t) => (t.fieldCount || 0) > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Form builder</h1>
          <p className="text-sm text-slate-500">Templates, fields, preview, and publish.</p>
        </div>
        <button
          type="button"
          onClick={openNewForm}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white"
        >
          New form
        </button>
      </div>

      {error && <div className="rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}
      {message && <div className="rounded-md bg-[#eaf7ea] px-3 py-2 text-sm text-[#0ca30c]">{message}</div>}

      {showTemplates && (
        <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Form templates</h2>
              <p className="text-xs text-slate-500">Pick a template to create a new form</p>
            </div>
            <button
              type="button"
              onClick={() => setShowTemplates(false)}
              className="text-sm text-slate-500 hover:text-slate-800"
              disabled={creating}
            >
              Cancel
            </button>
          </div>

          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Built-in</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(templates.builtIn || []).map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={creating}
                onClick={() => createFromTemplate(s)}
                className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60"
              >
                <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                <p className="mt-1 text-xs text-slate-500">{s.description}</p>
                <p className="mt-2 text-[11px] text-slate-400">
                  {s.fieldCount ? `${s.fieldCount} fields` : 'Empty'}
                </p>
              </button>
            ))}
          </div>

          {(templates.saved || []).length > 0 ? (
            <>
              <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Your templates
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {templates.saved.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={creating}
                    onClick={() => createFromTemplate(s)}
                    className="rounded-xl border border-brand-200 bg-brand-50/40 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60"
                  >
                    <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{s.description || 'Saved workspace template'}</p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {s.fieldCount ? `${s.fieldCount} fields` : 'Empty'}
                    </p>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border border-brand-100 bg-white p-3 shadow-sm">
          {forms.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-slate-400">No forms yet</p>
              <button
                type="button"
                onClick={openNewForm}
                className="mt-2 text-xs font-medium text-brand-600 hover:underline"
              >
                Create from template
              </button>
            </div>
          ) : (
            <ul className="space-y-1">
              {forms.map((f) => (
                <li key={f._id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(f);
                      setPreview(false);
                      setMessage('');
                      setError('');
                    }}
                    className={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm ${
                      selected?._id === f._id ? 'bg-brand-50 font-medium text-slate-800' : 'hover:bg-brand-50'
                    }`}
                  >
                    {f.name}
                    <span className="ml-1 text-[10px] text-slate-400">{f.status}</span>
                  </button>
                  <IconButton
                    label="Delete form"
                    tone="danger"
                    onClick={() => setDeleteTarget(f)}
                    className="h-7 w-7 opacity-70 group-hover:opacity-100"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {!selected ? (
          <div className="rounded-xl border border-dashed border-brand-200 bg-white p-8 text-center text-sm text-slate-500">
            <p>Select a form or create from a template.</p>
            <button
              type="button"
              onClick={openNewForm}
              className="mt-3 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white"
            >
              Browse templates
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input
                value={selected.name}
                onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                className="rounded-md border border-brand-200 px-3 py-2 text-sm font-medium"
              />
              <select
                value={selected.status}
                onChange={(e) => setSelected({ ...selected, status: e.target.value })}
                className="rounded-md border border-brand-200 px-2 py-2 text-sm"
              >
                <option value="draft">draft</option>
                <option value="published">published</option>
              </select>
              <label className="flex items-center gap-2 rounded-md border border-brand-200 px-2 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(selected.allowPublic)}
                  onChange={(e) => setSelected({ ...selected, allowPublic: e.target.checked })}
                />
                Public link
              </label>
              <button type="button" onClick={saveForm} className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white">
                Save
              </button>
              <button
                type="button"
                onClick={saveAsTemplate}
                className="rounded-md border border-brand-200 px-3 py-2 text-sm text-slate-700"
              >
                Save as template
              </button>
              {selected.allowPublic && selected.publicToken ? (
                <a
                  href={`/f/${selected.publicToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-brand-100 px-3 py-2 text-sm text-brand-700"
                >
                  Open public form
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setPreview((v) => !v)}
                className="rounded-md border border-brand-100 px-3 py-2 text-sm"
              >
                {preview ? 'Edit' : 'Preview'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await api.post(`/forms/${selected._id}/duplicate`);
                  await loadForms();
                  if (res.data.form) setSelected(res.data.form);
                }}
                className="rounded-md border border-brand-100 px-3 py-2 text-sm"
              >
                Duplicate
              </button>
              <IconButton
                label="Delete form"
                tone="danger"
                onClick={() => setDeleteTarget(selected)}
                className="border border-[#d03b3b]/30"
              >
                <TrashIcon />
              </IconButton>
            </div>

            {!preview ? (
              <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Fields</h2>
                  <button type="button" onClick={addField} className="text-sm font-medium text-slate-700">
                    + Add field
                  </button>
                </div>

                {(selected.fields || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-brand-200 bg-brand-50/40 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-slate-800">No fields yet</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Add fields one by one, or load a template set.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={addField}
                        className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white"
                      >
                        + Add field
                      </button>
                      {fieldTemplates.slice(0, 6).map((s) => (
                        <button
                          key={`${s.source}-${s.id}`}
                          type="button"
                          onClick={() => applyTemplateFields(s)}
                          className="rounded-md border border-brand-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-brand-50"
                        >
                          Use {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {(selected.fields || []).map((fieldItem, idx) => {
                      const id = fieldItem.id || fieldItem._id;
                      return (
                        <li
                          key={id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', String(idx))}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            moveField(Number(e.dataTransfer.getData('text/plain')), idx);
                          }}
                          className="grid gap-2 rounded-md border border-slate-100 p-3 md:grid-cols-4"
                        >
                          <input
                            value={fieldItem.name}
                            onChange={(e) =>
                              updateField(id, {
                                name: e.target.value,
                                key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                              })
                            }
                            className="rounded border border-brand-200 px-2 py-1 text-sm"
                          />
                          <select
                            value={fieldItem.type}
                            onChange={(e) => updateField(id, { type: e.target.value })}
                            className="rounded border border-brand-200 px-2 py-1 text-sm"
                          >
                            {FIELD_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <input
                            placeholder="Options comma-separated"
                            value={(fieldItem.options || []).join(', ')}
                            onChange={(e) =>
                              updateField(id, {
                                options: e.target.value
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                            className="rounded border border-brand-200 px-2 py-1 text-sm"
                          />
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={Boolean(fieldItem.required)}
                              onChange={(e) => updateField(id, { required: e.target.checked })}
                            />
                            Required · drag to reorder
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ) : (
              <form onSubmit={submitPreview} className="space-y-3 rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold">{selected.name} preview</h2>
                {(selected.fields || []).map((field) => {
                  const key = field.key;
                  return (
                    <div key={field.id || field._id}>
                      <label className="mb-1 block text-xs text-slate-600">
                        {field.name}
                        {field.required ? ' *' : ''}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          required={field.required}
                          value={values[key] || ''}
                          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                          className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
                        />
                      ) : (
                        <input
                          required={field.required}
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                          value={values[key] || ''}
                          onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
                        />
                      )}
                    </div>
                  );
                })}
                <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white">
                  Submit
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete form"
        message={`Delete form "${deleteTarget?.name || ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleting}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={confirmDeleteForm}
      />
    </div>
  );
}
