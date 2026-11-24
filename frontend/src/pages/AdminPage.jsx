import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatMoney, formatDate } from '../utils/format';

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  if (!user?.isSuperAdmin) return <Navigate to="/app" replace />;

  async function load() {
    const [s, t, a] = await Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/tenants'),
      api.get('/admin/audit-logs'),
    ]);
    setStats(s.data);
    setTenants(t.data.tenants || []);
    setLogs(a.data.logs || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.message || 'Failed to load admin data'));
  }, []);

  async function setStatus(id, status) {
    await api.patch(`/admin/tenants/${id}`, { status });
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Super Admin</h1>
        <p className="text-sm text-slate-500">Platform-wide tenant and revenue overview.</p>
      </div>

      {error && <div className="rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Tenants" value={stats.tenants} />
          <Stat label="Users" value={stats.users} />
          <Stat label="Paid invoices" value={stats.paidInvoiceCount} />
          <Stat label="Revenue" value={formatMoney(stats.revenue)} />
        </div>
      )}

      <section className="overflow-x-auto rounded-xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b px-4 py-3 text-sm font-semibold">Tenants</div>
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Usage</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-slate-400">{t.slug}</div>
                </td>
                <td className="px-4 py-2">{t.businessCategory}</td>
                <td className="px-4 py-2">{t.subscription?.plan?.name || '-'}</td>
                <td className="px-4 py-2">{t.status}</td>
                <td className="px-4 py-2 text-xs text-slate-500">
                  {t.members} users · {t.students} students · {t.records} records
                </td>
                <td className="px-4 py-2">
                  {t.status !== 'suspended' ? (
                    <button type="button" className="text-[#d03b3b]" onClick={() => setStatus(t.id, 'suspended')}>
                      Suspend
                    </button>
                  ) : (
                    <button type="button" className="text-slate-700" onClick={() => setStatus(t.id, 'active')}>
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b px-4 py-3 text-sm font-semibold">Recent audit logs</div>
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">When</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} className="border-t border-slate-100">
                <td className="px-4 py-2">{log.action}</td>
                <td className="px-4 py-2">
                  {log.entityType} {log.entityId}
                </td>
                <td className="px-4 py-2">{formatDate(log.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
