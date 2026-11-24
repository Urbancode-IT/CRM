import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

export default function MessagesPage() {
  const [templates, setTemplates] = useState([]);
  const [channels, setChannels] = useState({ whatsapp: false, sms: false });
  const [students, setStudents] = useState([]);
  const [templateId, setTemplateId] = useState('fee_due');
  const [studentId, setStudentId] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [body, setBody] = useState('');
  const [vars, setVars] = useState({ amount: '', date: '', month: '', year: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/messages/templates'),
      api.get('/students', { params: { status: 'active' } }),
    ])
      .then(([t, s]) => {
        setTemplates(t.data.templates || []);
        setChannels(t.data.channels || {});
        setStudents(s.data || []);
        const first = (t.data.templates || []).find((x) => x.id === 'fee_due');
        if (first) setBody(first.body);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load messages'));
  }, []);

  const selectedStudent = useMemo(
    () => students.find((s) => s._id === studentId),
    [students, studentId]
  );

  useEffect(() => {
    if (!selectedStudent) return;
    setPhone(selectedStudent.parentPhone || selectedStudent.phone || '');
    const now = new Date();
    setVars((v) => ({
      ...v,
      amount: String(selectedStudent.monthlyFee ?? v.amount ?? ''),
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
      date: now.toLocaleDateString('en-IN'),
    }));
  }, [selectedStudent]);

  function applyTemplate(id) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    setBody(t?.body || '');
  }

  async function handleSend(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSending(true);
    try {
      const res = await api.post('/messages/send', {
        templateId,
        channel,
        studentId: studentId || undefined,
        phone: phone || undefined,
        body,
        vars,
      });
      setMessage(
        res.data.note
          ? `${res.data.note}. Preview logged.`
          : 'Message sent (or queued).'
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900">Messages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Quick WhatsApp / SMS templates for fees, attendance, and demos.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span
          className={`rounded-md px-2 py-1 ${
            channels.whatsapp ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          WhatsApp {channels.whatsapp ? 'connected' : 'env off (logs only)'}
        </span>
        <span
          className={`rounded-md px-2 py-1 ${
            channels.sms ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          SMS {channels.sms ? 'connected' : 'env off'}
        </span>
      </div>

      {error && <div className="rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}
      {message && <div className="rounded-md bg-[#eaf7ea] px-3 py-2 text-sm text-[#0ca30c]">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-1 rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Templates
          </p>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                templateId === t.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="block font-medium">{t.name}</span>
              <span className={`text-[10px] uppercase ${templateId === t.id ? 'text-white/60' : 'text-slate-400'}`}>
                {t.category}
              </span>
            </button>
          ))}
        </aside>

        <form onSubmit={handleSend} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Student (optional)</span>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Manual phone only</option>
                {students.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Phone</span>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Channel</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Amount (₹)</span>
              <input
                value={vars.amount}
                onChange={(e) => setVars({ ...vars, amount: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Message</span>
            <textarea
              required
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm leading-relaxed"
            />
            <span className="mt-1 block text-[11px] text-slate-400">
              Tokens: {'{{parentName}} {{studentName}} {{amount}} {{month}} {{year}} {{date}} {{centreName}}'}
            </span>
          </label>

          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Send message'}
          </button>
        </form>
      </div>
    </div>
  );
}
