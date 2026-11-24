import { useEffect, useState } from 'react';
import api from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import { toastError, toastSuccess } from '../utils/toast';

function formatWhen(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

export default function RecycleBinPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [confirm, setConfirm] = useState(null);
  // { type: 'purge' | 'empty', id?, name? }

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/recycle-bin');
      setItems(res.data.items || []);
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to load recycle bin');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function restore(id) {
    setBusyId(id);
    try {
      await api.post(`/recycle-bin/${id}/restore`);
      toastSuccess('Student restored');
      await load();
    } catch (err) {
      toastError(err.response?.data?.message || 'Restore failed');
    } finally {
      setBusyId('');
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    setBusyId(confirm.type === 'empty' ? 'empty' : confirm.id);
    try {
      if (confirm.type === 'purge') {
        await api.delete(`/recycle-bin/${confirm.id}`);
        toastSuccess('Permanently deleted');
      } else {
        const res = await api.post('/recycle-bin/empty');
        toastSuccess(res.data.message || 'Recycle bin emptied');
      }
      setConfirm(null);
      await load();
    } catch (err) {
      toastError(err.response?.data?.message || 'Delete failed');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Recycle Bin</h1>
          <p className="text-sm text-slate-500">
            Deleted students stay here until you restore or permanently delete them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirm({ type: 'empty' })}
          disabled={!items.length || busyId === 'empty'}
          className="rounded-md border border-[#d03b3b]/30 px-3 py-2 text-sm font-medium text-[#d03b3b] hover:bg-[#fdeaea] disabled:opacity-50"
        >
          {busyId === 'empty' ? 'Emptying...' : 'Empty bin'}
        </button>
      </div>

      {loading && <div className="text-sm text-slate-500">Loading...</div>}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-brand-100 bg-white shadow-sm">
          <table className="w-full min-w-[560px] table-fixed text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[14%]" />
              <col className="w-[22%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="bg-brand-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-left font-medium">Type</th>
                <th className="px-4 py-2.5 text-left font-medium">Deleted</th>
                <th className="px-4 py-2.5 text-center font-medium">Restore</th>
                <th className="px-4 py-2.5 text-center font-medium">Delete</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 align-middle">
                    <div className="font-medium text-slate-900">{item.name}</div>
                    {item.meta ? <div className="text-xs text-slate-500">{item.meta}</div> : null}
                    {item.email ? <div className="text-xs text-slate-400">{item.email}</div> : null}
                  </td>
                  <td className="px-4 py-2.5 align-middle capitalize text-slate-600">{item.type}</td>
                  <td className="px-4 py-2.5 align-middle text-slate-600">{formatWhen(item.deletedAt)}</td>
                  <td className="px-4 py-2.5 text-center align-middle">
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => restore(item.id)}
                      className="rounded-md bg-[#eaf7ea] px-3 py-1.5 text-xs font-medium text-[#0ca30c] hover:bg-[#dcf0dc] disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-center align-middle">
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => setConfirm({ type: 'purge', id: item.id, name: item.name })}
                      className="rounded-md bg-[#fdeaea] px-3 py-1.5 text-xs font-medium text-[#d03b3b] hover:bg-[#f8d4d4] disabled:opacity-50"
                    >
                      Delete forever
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Recycle bin is empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.type === 'empty' ? 'Empty recycle bin' : 'Delete forever'}
        message={
          confirm?.type === 'empty'
            ? `${items.length} student(s) will be permanently deleted with their payments and attendance. This cannot be undone.`
            : `Permanently delete “${confirm?.name || ''}”? Payments and attendance for this student will also be removed. This cannot be undone.`
        }
        confirmLabel={confirm?.type === 'empty' ? 'Empty bin' : 'Delete forever'}
        busy={Boolean(busyId)}
        onClose={() => {
          if (!busyId) setConfirm(null);
        }}
        onConfirm={runConfirm}
      />
    </div>
  );
}
