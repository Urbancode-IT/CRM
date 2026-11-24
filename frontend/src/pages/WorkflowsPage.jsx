import { useEffect, useState } from 'react';
import api from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import { IconButton, PauseIcon, PlayIcon, TrashIcon } from '../components/icons';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState([]);
  const [modules, setModules] = useState([]);
  const [form, setForm] = useState({
    name: '',
    trigger: 'create',
    module: '',
    actionType: 'create_task',
    actionTitle: 'Follow up task',
  });
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const [w, m] = await Promise.all([api.get('/workflows'), api.get('/custom-modules')]);
    setWorkflows(w.data.workflows || []);
    setModules(m.data.modules || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.message || 'Failed to load'));
  }, []);

  async function createWorkflow(e) {
    e.preventDefault();
    try {
      await api.post('/workflows', {
        name: form.name,
        trigger: form.trigger,
        module: form.module || undefined,
        actions: [
          {
            type: form.actionType,
            config:
              form.actionType === 'update_field'
                ? { fieldKey: form.actionTitle.split('=')[0]?.trim() || 'status', value: form.actionTitle.split('=')[1]?.trim() || 'done' }
                : { title: form.actionTitle, message: form.actionTitle },
          },
        ],
        conditions: [],
        isActive: true,
      });
      setForm({ name: '', trigger: 'create', module: '', actionType: 'create_task', actionTitle: 'Follow up task' });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Create failed');
    }
  }

  async function toggle(wf) {
    await api.patch(`/workflows/${wf._id}`, { isActive: !wf.isActive });
    await load();
  }

  async function confirmRemove() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/workflows/${deleteId}`);
      setDeleteId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Workflows</h1>
        <p className="text-sm text-slate-500">Automate follow-ups when records change.</p>
      </div>

      {error && <div className="rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}

      <form onSubmit={createWorkflow} className="grid gap-3 rounded-xl border border-brand-100 bg-white p-4 shadow-sm md:grid-cols-2">
        <input
          required
          placeholder="Workflow name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        />
        <select
          value={form.trigger}
          onChange={(e) => setForm({ ...form, trigger: e.target.value })}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        >
          <option value="create">On create</option>
          <option value="update">On update</option>
          <option value="delete">On delete</option>
        </select>
        <select
          value={form.module}
          onChange={(e) => setForm({ ...form, module: e.target.value })}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        >
          <option value="">Any / system modules</option>
          {modules.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          value={form.actionType}
          onChange={(e) => setForm({ ...form, actionType: e.target.value })}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm"
        >
          <option value="create_task">Create task</option>
          <option value="notify">Notify (email)</option>
          <option value="update_field">Update field</option>
        </select>
        <input
          value={form.actionTitle}
          onChange={(e) => setForm({ ...form, actionTitle: e.target.value })}
          className="rounded-md border border-brand-200 px-3 py-2 text-sm md:col-span-2"
          placeholder="Action title (e.g. Welcome call) — student name auto-added"
        />
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white md:col-span-2">
          Create workflow
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-brand-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Trigger</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {workflows.map((wf) => (
              <tr key={wf._id} className="border-t border-slate-100">
                <td className="px-4 py-2">{wf.name}</td>
                <td className="px-4 py-2">{wf.trigger}</td>
                <td className="px-4 py-2">{wf.isActive ? 'active' : 'paused'}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    <IconButton
                      label={wf.isActive ? 'Pause' : 'Enable'}
                      onClick={() => toggle(wf)}
                    >
                      {wf.isActive ? <PauseIcon /> : <PlayIcon />}
                    </IconButton>
                    <IconButton label="Delete" tone="danger" onClick={() => setDeleteId(wf._id)}>
                      <TrashIcon />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
            {workflows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No workflows yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete workflow"
        message="Delete this workflow? This cannot be undone."
        confirmLabel="Delete"
        busy={deleting}
        onClose={() => {
          if (!deleting) setDeleteId(null);
        }}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
