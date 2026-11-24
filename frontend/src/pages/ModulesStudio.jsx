import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  'multiselect',
  'checkbox',
  'radio',
  'textarea',
  'lookup',
];

export default function ModulesStudio() {
  const [tab, setTab] = useState('catalog'); // catalog | installed
  const [modules, setModules] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [usage, setUsage] = useState({ used: 0, limit: null });
  const [planCode, setPlanCode] = useState('trial');
  const [selected, setSelected] = useState(null);
  const [fields, setFields] = useState([]);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldForm, setFieldForm] = useState({ name: '', type: 'text', required: false, options: '' });
  const [recordValues, setRecordValues] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [installing, setInstalling] = useState('');
  const [recordView, setRecordView] = useState('table'); // table | board

  async function loadModules() {
    const res = await api.get('/custom-modules');
    const list = res.data.modules || [];
    setModules(list);
    return list;
  }

  async function loadCatalog() {
    const res = await api.get('/custom-modules/catalog');
    setCatalog(res.data.catalog || []);
    setUsage(res.data.usage || { used: 0, limit: null });
    setPlanCode(res.data.planCode || 'trial');
  }

  async function selectModule(mod) {
    setSelected(mod);
    setTab('installed');
    const [f, r] = await Promise.all([
      api.get(`/custom-modules/${mod._id}/fields`),
      api.get(`/custom-modules/${mod._id}/records`),
    ]);
    setFields(f.data.fields || []);
    setRecords(r.data.items || []);
    setRecordValues({});
    const isLeads =
      mod.slug === 'leads' || String(mod.systemKey || '').includes('leads');
    setRecordView(isLeads ? 'board' : 'table');
  }

  useEffect(() => {
    Promise.all([loadModules(), loadCatalog()])
      .then(async ([list]) => {
        const firstCustom = list.find((m) => !m.isSystem);
        if (firstCustom) await selectModule(firstCustom);
        else setTab('catalog');
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load modules'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function installModule(item) {
    if (!item.unlocked || item.installed || installing) return;
    setInstalling(item.id);
    setError('');
    setMessage('');
    try {
      const res = await api.post(`/custom-modules/catalog/${item.id}/install`);
      await Promise.all([loadModules(), loadCatalog()]);
      setMessage(`“${item.name}” added — ready to use.`);
      if (res.data.module) await selectModule(res.data.module);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add module');
    } finally {
      setInstalling('');
    }
  }

  function askDeleteModule(mod, e) {
    e?.stopPropagation();
    if (mod.isSystem) return;
    setConfirmDelete(mod);
  }

  async function confirmDeleteModule() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      setError('');
      await api.delete(`/custom-modules/${confirmDelete._id}`);
      if (selected?._id === confirmDelete._id) {
        setSelected(null);
        setFields([]);
        setRecords([]);
      }
      setConfirmDelete(null);
      await Promise.all([loadModules(), loadCatalog()]);
      setTab('catalog');
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  async function addField(e) {
    e.preventDefault();
    if (!selected) return;
    try {
      await api.post(`/custom-modules/${selected._id}/fields`, {
        name: fieldForm.name,
        type: fieldForm.type,
        required: fieldForm.required,
        options: fieldForm.options
          ? fieldForm.options.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      });
      setFieldForm({ name: '', type: 'text', required: false, options: '' });
      await selectModule(selected);
    } catch (err) {
      setError(err.response?.data?.message || 'Field create failed');
    }
  }

  async function reorder(from, to) {
    if (!selected || to < 0 || to >= fields.length) return;
    const next = fields.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const orders = next.map((f, i) => ({ id: f._id, order: i }));
    setFields(next);
    await api.put(`/custom-modules/${selected._id}/fields/reorder`, { orders });
  }

  async function createRecord(e) {
    e.preventDefault();
    if (!selected) return;
    await api.post(`/custom-modules/${selected._id}/records`, { values: recordValues });
    setRecordValues({});
    await selectModule(selected);
  }

  const canConvertToStudent =
    selected &&
    !selected.isSystem &&
    (selected.slug === 'leads' ||
      String(selected.systemKey || '').includes('leads') ||
      catalog.some((c) => c.id === selected.slug && c.convertToStudent));

  const statusField =
    fields.find((f) => f.key === 'status' && (f.type === 'dropdown' || f.type === 'radio')) ||
    fields.find((f) => /status/i.test(f.name) && (f.type === 'dropdown' || f.type === 'radio'));
  const boardColumns = statusField?.options?.length
    ? statusField.options
    : canConvertToStudent
      ? ['New', 'Contacted', 'Demo booked', 'Won', 'Lost']
      : [];
  const canBoard = Boolean(statusField) || canConvertToStudent;
  const titleField =
    fields.find((f) => f.key === 'contact_name' || f.key === 'student_name' || f.key === 'title') ||
    fields.find((f) => f.type === 'text') ||
    fields[0];

  async function moveRecordStatus(record, nextStatus) {
    if (!selected || !statusField || !record) return;
    const key = statusField.key;
    if (String(record.values?.[key] || '') === String(nextStatus)) return;
    setError('');
    try {
      await api.patch(`/custom-modules/${selected._id}/records/${record._id}`, {
        values: { [key]: nextStatus },
      });
      setRecords((prev) =>
        prev.map((r) =>
          r._id === record._id ? { ...r, values: { ...(r.values || {}), [key]: nextStatus } } : r
        )
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update status');
    }
  }

  async function convertToStudent(record) {
    if (!selected || !record) return;
    setError('');
    setMessage('');
    try {
      const res = await api.post(
        `/custom-modules/${selected._id}/records/${record._id}/convert-student`
      );
      setMessage(`Student created: ${res.data.student?.name || 'OK'}`);
      await selectModule(selected);
    } catch (err) {
      setError(err.response?.data?.message || 'Convert failed');
    }
  }

  async function exportCsv() {
    if (!selected) return;
    const res = await api.get(`/custom-modules/${selected._id}/records/export`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selected.slug}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const installedCustom = modules.filter((m) => !m.isSystem);
  const usageLabel =
    usage.limit != null ? `${usage.used}/${usage.limit} modules used · ${planCode} plan` : `${planCode} plan`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Modules</h1>
          <p className="text-sm text-slate-500">
            Ready modules like Zoho — unlock by plan, enable only what you need.
            <span className="ml-1 text-slate-400">· {usageLabel}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('catalog')}
            className={`rounded-md px-3 py-2 text-sm ${
              tab === 'catalog' ? 'bg-brand-600 text-white' : 'border border-brand-200 text-slate-700'
            }`}
          >
            Available modules
          </button>
          <button
            type="button"
            onClick={() => setTab('installed')}
            className={`rounded-md px-3 py-2 text-sm ${
              tab === 'installed' ? 'bg-brand-600 text-white' : 'border border-brand-200 text-slate-700'
            }`}
          >
            My modules ({installedCustom.length})
          </button>
        </div>
      </div>

      {error && <div className="rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}
      {message && <div className="rounded-md bg-[#eaf7ea] px-3 py-2 text-sm text-[#0ca30c]">{message}</div>}

      {tab === 'catalog' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {catalog.map((item) => {
            const locked = !item.unlocked;
            const busy = installing === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 shadow-sm ${
                  locked ? 'border-slate-200 bg-slate-50' : 'border-brand-100 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                  </div>
                  <span className="shrink-0 rounded bg-brand-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                    {item.minPlan}+
                  </span>
                </div>
                <p className="mt-3 text-[11px] text-slate-400">
                  {item.fieldCount ? `${item.fieldCount} ready fields` : 'Blank — add your fields'}
                  {item.installed ? ' · Installed' : ''}
                  {locked ? ` · ${item.lockedReason}` : ''}
                </p>
                <div className="mt-4">
                  {item.installed ? (
                    <button
                      type="button"
                      onClick={() => {
                        const mod = modules.find((m) => m.slug === item.id);
                        if (mod) selectModule(mod);
                      }}
                      className="rounded-md border border-brand-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-brand-50"
                    >
                      Open
                    </button>
                  ) : locked ? (
                    <Link
                      to="/app/billing"
                      className="inline-block rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
                    >
                      Upgrade to unlock
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => installModule(item)}
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      {busy ? 'Adding…' : 'Enable'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-xl border border-brand-100 bg-white p-3 shadow-sm">
            <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Enabled
            </p>
            <ul className="space-y-1">
              {installedCustom.map((m) => (
                <li key={m._id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => selectModule(m)}
                    className={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm ${
                      selected?._id === m._id ? 'bg-brand-50 text-slate-700' : 'hover:bg-brand-50'
                    }`}
                  >
                    {m.name}
                  </button>
                  <IconButton
                    label={`Delete ${m.name}`}
                    tone="danger"
                    onClick={(e) => askDeleteModule(m, e)}
                    className="opacity-80 group-hover:opacity-100"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </IconButton>
                </li>
              ))}
              {installedCustom.length === 0 && (
                <li className="px-2 py-6 text-center text-xs text-slate-400">
                  None yet — open Available modules and Enable one.
                </li>
              )}
            </ul>
            <button
              type="button"
              onClick={() => setTab('catalog')}
              className="mt-3 w-full rounded-md border border-dashed border-brand-200 px-2 py-2 text-xs font-medium text-slate-600 hover:bg-brand-50"
            >
              + Add from catalog
            </button>
          </aside>

          <div className="space-y-4">
            {!selected || selected.isSystem ? (
              <div className="rounded-xl border border-dashed border-brand-200 bg-white p-8 text-center text-sm text-slate-500">
                Select an enabled module, or enable one from the catalog.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-100 bg-white px-4 py-3 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selected.name}</p>
                    <p className="text-xs text-slate-500">{selected.description || 'Custom module'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canBoard ? (
                      <div className="flex rounded-lg border border-slate-200 p-0.5">
                        <button
                          type="button"
                          onClick={() => setRecordView('table')}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                            recordView === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600'
                          }`}
                        >
                          Table
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecordView('board')}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                            recordView === 'board' ? 'bg-slate-900 text-white' : 'text-slate-600'
                          }`}
                        >
                          Pipeline
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={exportCsv}
                      className="rounded-md border border-brand-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-brand-50"
                    >
                      Export CSV
                    </button>
                    <IconButton
                      label="Delete module"
                      tone="danger"
                      onClick={(e) => askDeleteModule(selected, e)}
                      className="border border-[#d03b3b]/30"
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                </div>

                <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-slate-800">Fields</h2>
                  <form onSubmit={addField} className="mb-4 grid gap-2 md:grid-cols-4">
                    <input
                      required
                      placeholder="Field name"
                      value={fieldForm.name}
                      onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                      className="rounded-md border border-brand-200 px-2 py-1.5 text-sm"
                    />
                    <select
                      value={fieldForm.type}
                      onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value })}
                      className="rounded-md border border-brand-200 px-2 py-1.5 text-sm"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Options (comma)"
                      value={fieldForm.options}
                      onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })}
                      className="rounded-md border border-brand-200 px-2 py-1.5 text-sm"
                    />
                    <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white">
                      Add field
                    </button>
                  </form>
                  <ul className="space-y-2">
                    {fields.map((f, idx) => (
                      <li
                        key={f._id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', String(idx))}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = Number(e.dataTransfer.getData('text/plain'));
                          reorder(from, idx);
                        }}
                        className="flex cursor-move items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-sm"
                      >
                        <span>
                          {f.name} <span className="text-slate-400">({f.type})</span>
                          {f.required ? ' *' : ''}
                        </span>
                        <span className="text-xs text-slate-400">drag to reorder</span>
                      </li>
                    ))}
                    {fields.length === 0 && (
                      <li className="py-4 text-center text-sm text-slate-400">No fields yet</li>
                    )}
                  </ul>
                </section>

                <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-slate-800">Add record</h2>
                  {fields.length === 0 ? (
                    <p className="text-sm text-slate-500">Add fields first, then create records.</p>
                  ) : (
                    <form onSubmit={createRecord} className="grid gap-3 md:grid-cols-2">
                      {fields.map((f) => (
                        <div key={f._id}>
                          <label className="mb-1 block text-xs text-slate-600">
                            {f.name}
                            {f.required ? ' *' : ''}
                          </label>
                          {f.type === 'textarea' ? (
                            <textarea
                              required={f.required}
                              value={recordValues[f.key] || ''}
                              onChange={(e) =>
                                setRecordValues({ ...recordValues, [f.key]: e.target.value })
                              }
                              className="w-full rounded-md border border-brand-200 px-2 py-1.5 text-sm"
                            />
                          ) : f.type === 'dropdown' || f.type === 'radio' ? (
                            <select
                              required={f.required}
                              value={recordValues[f.key] || ''}
                              onChange={(e) =>
                                setRecordValues({ ...recordValues, [f.key]: e.target.value })
                              }
                              className="w-full rounded-md border border-brand-200 px-2 py-1.5 text-sm"
                            >
                              <option value="">Select</option>
                              {(f.options || []).map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                              required={f.required}
                              value={recordValues[f.key] || ''}
                              onChange={(e) =>
                                setRecordValues({ ...recordValues, [f.key]: e.target.value })
                              }
                              className="w-full rounded-md border border-brand-200 px-2 py-1.5 text-sm"
                            />
                          )}
                        </div>
                      ))}
                      <div className="md:col-span-2">
                        <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white">
                          Save record
                        </button>
                      </div>
                    </form>
                  )}
                </section>

                {canBoard && recordView === 'board' ? (
                  <section className="overflow-x-auto pb-2">
                    <div className="flex min-w-max gap-3">
                      {boardColumns.map((col) => {
                        const key = statusField?.key || 'status';
                        const colRecords = records.filter(
                          (r) => String(r.values?.[key] || boardColumns[0]) === String(col)
                        );
                        return (
                          <div
                            key={col}
                            className="flex w-64 flex-col rounded-xl border border-slate-200 bg-slate-50"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const id = e.dataTransfer.getData('text/record-id');
                              const rec = records.find((r) => r._id === id);
                              if (rec) moveRecordStatus(rec, col);
                            }}
                          >
                            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                              <span className="text-xs font-semibold text-slate-700">{col}</span>
                              <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] text-slate-500">
                                {colRecords.length}
                              </span>
                            </div>
                            <div className="flex flex-1 flex-col gap-2 p-2">
                              {colRecords.map((r) => (
                                <div
                                  key={r._id}
                                  draggable
                                  onDragStart={(e) => e.dataTransfer.setData('text/record-id', r._id)}
                                  className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                                >
                                  <p className="text-sm font-medium text-slate-900">
                                    {String(
                                      r.values?.[titleField?.key] ||
                                        r.values?.contact_name ||
                                        r.values?.student_name ||
                                        'Lead'
                                    )}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {r.values?.phone || r.values?.interest || '—'}
                                  </p>
                                  {canConvertToStudent && !r.values?.converted_student_id && col === 'Won' ? (
                                    <button
                                      type="button"
                                      onClick={() => convertToStudent(r)}
                                      className="mt-2 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700"
                                    >
                                      → Student
                                    </button>
                                  ) : null}
                                  {r.values?.converted_student_id ? (
                                    <p className="mt-2 text-[11px] font-medium text-emerald-700">Converted</p>
                                  ) : null}
                                </div>
                              ))}
                              {colRecords.length === 0 ? (
                                <p className="px-1 py-6 text-center text-[11px] text-slate-400">Drop here</p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : (
                  <section className="overflow-x-auto rounded-xl border border-brand-100 bg-white shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-brand-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">ID</th>
                          {fields.map((f) => (
                            <th key={f._id} className="px-3 py-2">
                              {f.name}
                            </th>
                          ))}
                          {canConvertToStudent ? (
                            <th className="px-3 py-2 text-center">Convert</th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r) => (
                          <tr key={r._id} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-xs text-slate-400">{String(r._id).slice(-6)}</td>
                            {fields.map((f) => (
                              <td key={f._id} className="px-3 py-2">
                                {String(r.values?.[f.key] ?? '-')}
                              </td>
                            ))}
                            {canConvertToStudent ? (
                              <td className="px-3 py-2 text-center">
                                {r.values?.converted_student_id ? (
                                  <span className="text-xs text-[#0ca30c]">Converted</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => convertToStudent(r)}
                                    className="rounded-md bg-[#eaf7ea] px-2 py-1 text-xs font-medium text-[#0ca30c] hover:bg-[#dcf0dc]"
                                  >
                                    → Student
                                  </button>
                                )}
                              </td>
                            ) : null}
                          </tr>
                        ))}
                        {records.length === 0 && (
                          <tr>
                            <td
                              colSpan={fields.length + 1 + (canConvertToStudent ? 1 : 0)}
                              className="px-3 py-6 text-center text-slate-500"
                            >
                              No records yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Remove module"
        message={`Remove “${confirmDelete?.name || ''}”? Fields and records will also be deleted.`}
        confirmLabel="Remove"
        busy={deleting}
        onClose={() => {
          if (!deleting) setConfirmDelete(null);
        }}
        onConfirm={confirmDeleteModule}
      />
    </div>
  );
}
