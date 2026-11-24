import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import { IconButton, TrashIcon } from '../components/icons';

function newLocalId() {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function CustomSection() {
  const { moduleId, sectionId } = useParams();
  const [section, setSection] = useState(null);
  const [moduleName, setModuleName] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkedModule, setLinkedModule] = useState(null);
  const [fields, setFields] = useState([]);
  const [records, setRecords] = useState([]);
  const [recordValues, setRecordValues] = useState({});
  const [fieldName, setFieldName] = useState('');
  const saveTimer = useRef(null);

  async function loadLinkedData(linkedId) {
    if (!linkedId) {
      setLinkedModule(null);
      setFields([]);
      setRecords([]);
      return;
    }
    try {
      const [mods, f, r] = await Promise.all([
        api.get('/custom-modules'),
        api.get(`/custom-modules/${linkedId}/fields`),
        api.get(`/custom-modules/${linkedId}/records`),
      ]);
      const mod = (mods.data.modules || []).find((m) => m._id === linkedId || m.id === linkedId);
      setLinkedModule(mod || { _id: linkedId, name: 'Data table' });
      setFields(f.data.fields || []);
      setRecords(r.data.items || []);
    } catch {
      setLinkedModule(null);
      setFields([]);
      setRecords([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setMessage('');
    api
      .get('/modules')
      .then(async (res) => {
        if (cancelled) return;
        const mod = (res.data.modules || []).find((m) => m.id === moduleId);
        if (!mod) {
          setError('Module not found');
          setSection(null);
          return;
        }
        setModuleName(mod.name);
        const sec = (mod.sections || []).find((s) => s.id === sectionId);
        if (!sec) {
          setError('Section not found');
          setSection(null);
          return;
        }
        setSection(sec);
        setTitle(sec.name || '');
        setContent(sec.content || '');
        setChecklist(
          (sec.checklist || []).map((c) => ({
            id: c.id || newLocalId(),
            text: c.text,
            done: Boolean(c.done),
          }))
        );
        await loadLinkedData(sec.linkedModuleId);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load section');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [moduleId, sectionId]);

  async function save(overrides = {}) {
    const nextTitle = overrides.title !== undefined ? overrides.title : title;
    const nextContent = overrides.content !== undefined ? overrides.content : content;
    const nextChecklist = overrides.checklist !== undefined ? overrides.checklist : checklist;
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/modules/${moduleId}/sections/${sectionId}`, {
        name: nextTitle,
        content: nextContent,
        checklist: nextChecklist.map((c) => ({
          id: c.id,
          text: c.text,
          done: c.done,
        })),
        linkedModuleId: overrides.linkedModuleId !== undefined
          ? overrides.linkedModuleId
          : section?.linkedModuleId || null,
      });
      const sec = res.data.section;
      setSection(sec);
      setTitle(sec.name || '');
      setContent(sec.content || '');
      setChecklist(
        (sec.checklist || []).map((c) => ({
          id: c.id || newLocalId(),
          text: c.text,
          done: Boolean(c.done),
        }))
      );
      setMessage('Saved');
      setTimeout(() => setMessage(''), 1500);
      return sec;
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  }

  function scheduleSave(overrides) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(overrides), 600);
  }

  function addChecklistItem(e) {
    e.preventDefault();
    const text = newItem.trim();
    if (!text) return;
    const next = [...checklist, { id: newLocalId(), text, done: false }];
    setChecklist(next);
    setNewItem('');
    save({ checklist: next });
  }

  function toggleItem(id) {
    const next = checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c));
    setChecklist(next);
    save({ checklist: next });
  }

  function removeItem(id) {
    const next = checklist.filter((c) => c.id !== id);
    setChecklist(next);
    save({ checklist: next });
  }

  async function createLinkedTable() {
    setError('');
    try {
      const res = await api.post('/custom-modules', {
        name: `${moduleName} · ${title || section?.name || 'Data'}`.slice(0, 80),
        description: `Data table for sidebar section ${title || section?.name}`,
      });
      const mod = res.data.module;
      const linkedId = mod._id || mod.id;
      const sec = await save({ linkedModuleId: linkedId });
      if (sec) await loadLinkedData(linkedId);
      setMessage('Data table linked');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create data table');
    }
  }

  async function addField(e) {
    e.preventDefault();
    if (!linkedModule || !fieldName.trim()) return;
    const id = linkedModule._id || linkedModule.id;
    try {
      await api.post(`/custom-modules/${id}/fields`, {
        name: fieldName.trim(),
        type: 'text',
        required: false,
      });
      setFieldName('');
      await loadLinkedData(id);
    } catch (err) {
      setError(err.response?.data?.message || 'Field create failed');
    }
  }

  async function addRecord(e) {
    e.preventDefault();
    if (!linkedModule) return;
    const id = linkedModule._id || linkedModule.id;
    try {
      await api.post(`/custom-modules/${id}/records`, { values: recordValues });
      setRecordValues({});
      await loadLinkedData(id);
    } catch (err) {
      setError(err.response?.data?.message || 'Record create failed');
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Loading section...</div>;
  if (error && !section) return <div className="text-sm text-[#d03b3b]">{error}</div>;
  if (!section) return null;

  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{moduleName}</p>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave({ title: e.target.value });
            }}
            className="mt-1 w-full max-w-xl border-0 bg-transparent text-lg font-semibold text-slate-900 outline-none ring-0 placeholder:text-slate-300"
            placeholder="Section name"
          />
          <p className="mt-1 text-sm text-slate-500">
            Notes, checklist, and optional data table for this page.
            {saving ? ' · Saving…' : message ? ` · ${message}` : ''}
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => save()}
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error ? <div className="rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Notes</h2>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              scheduleSave({ content: e.target.value });
            }}
            rows={10}
            placeholder="Write process notes, fee rules, scripts, follow-up steps…"
            className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </section>

        <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Checklist</h2>
            <span className="text-xs text-slate-400">
              {doneCount}/{checklist.length} done
            </span>
          </div>
          <form onSubmit={addChecklistItem} className="mb-3 flex gap-2">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add a to-do item"
              className="w-full rounded-md border border-brand-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Add
            </button>
          </form>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={Boolean(item.done)}
                  onChange={() => toggleItem(item.id)}
                  className="h-4 w-4 rounded border-brand-200 text-brand-600"
                />
                <span
                  className={`min-w-0 flex-1 ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}
                >
                  {item.text}
                </span>
                <IconButton label="Remove" tone="danger" onClick={() => removeItem(item.id)}>
                  <TrashIcon className="h-3.5 w-3.5" />
                </IconButton>
              </li>
            ))}
            {checklist.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">No checklist items yet</li>
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Data table</h2>
            <p className="text-xs text-slate-500">
              Store rows for this section (leads, inventory, inventory notes, etc.).
            </p>
          </div>
          {!linkedModule ? (
            <button
              type="button"
              onClick={createLinkedTable}
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Create data table
            </button>
          ) : (
            <Link
              to="/app/modules"
              className="rounded-md border border-brand-200 px-3 py-2 text-sm text-slate-700 hover:bg-brand-50"
            >
              Open in Custom modules
            </Link>
          )}
        </div>

        {!linkedModule ? (
          <p className="rounded-lg border border-dashed border-brand-200 bg-brand-50/40 px-4 py-8 text-center text-sm text-slate-500">
            No data table yet — create one to add fields and records here.
          </p>
        ) : (
          <div className="space-y-4">
            <form onSubmit={addField} className="flex flex-wrap gap-2">
              <input
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="New field name"
                className="min-w-[180px] flex-1 rounded-md border border-brand-200 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-md border border-brand-200 px-3 py-2 text-sm text-slate-700">
                + Field
              </button>
            </form>

            {fields.length > 0 && (
              <form onSubmit={addRecord} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map((f) => {
                  const key = f.key || f.name;
                  return (
                    <input
                      key={f._id || f.id}
                      value={recordValues[key] || ''}
                      onChange={(e) => setRecordValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={f.name}
                      className="rounded-md border border-brand-200 px-3 py-2 text-sm"
                    />
                  );
                })}
                <button
                  type="submit"
                  className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 sm:col-span-2 lg:col-span-1"
                >
                  + Add row
                </button>
              </form>
            )}

            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-brand-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {fields.map((f) => (
                      <th key={f._id || f.id} className="px-3 py-2 font-medium">
                        {f.name}
                      </th>
                    ))}
                    {fields.length === 0 && <th className="px-3 py-2 font-medium">Columns</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((row) => (
                    <tr key={row._id || row.id} className="border-t border-slate-100">
                      {fields.map((f) => {
                        const key = f.key || f.name;
                        return (
                          <td key={f._id || f.id} className="px-3 py-2 text-slate-700">
                            {String(row.values?.[key] ?? '')}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={Math.max(fields.length, 1)} className="px-3 py-8 text-center text-slate-400">
                        {fields.length ? 'No rows yet — add one above.' : 'Add a field first, then add rows.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
