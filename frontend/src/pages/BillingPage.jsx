import { useEffect, useState } from 'react';
import api from '../services/api';
import { formatMoney, formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { openCashfreeCheckout, openRazorpayCheckout } from '../utils/paymentCheckout';

export default function BillingPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [cycle, setCycle] = useState('monthly');
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState('dev');
  const [cashfreeMode, setCashfreeMode] = useState('sandbox');
  const [couponCode, setCouponCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [p, s, g] = await Promise.all([
      api.get('/billing/plans'),
      api.get('/billing/subscription'),
      api.get('/billing/providers'),
    ]);
    setPlans((p.data.plans || []).filter((x) => x.code !== 'trial'));
    setSubscription(s.data.subscription);
    setInvoices(s.data.invoices || []);
    const list = g.data.providers || [];
    setProviders(list);
    setCashfreeMode(g.data.cashfreeMode || 'sandbox');
    setProvider((prev) => {
      if (list.some((x) => x.id === prev)) return prev;
      return g.data.defaultProvider || 'dev';
    });
  }

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.message || 'Failed to load billing'));
  }, []);

  async function checkout(planCode) {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const res = await api.post('/billing/checkout', {
        planCode,
        billingCycle: cycle,
        provider,
        couponCode: couponCode || undefined,
      });
      const data = res.data;

      if (data.mode === 'dev' || data.provider === 'dev') {
        await api.post('/billing/confirm', {
          invoiceId: data.invoiceId,
          planCode,
          billingCycle: cycle,
          provider: 'dev',
        });
        setMessage(`Upgraded to ${planCode} (simulated payment)`);
        await load();
        return;
      }

      if (data.provider === 'razorpay' || data.mode === 'razorpay') {
        const payment = await openRazorpayCheckout({
          keyId: data.keyId,
          amount: data.amount,
          currency: data.currency,
          orderId: data.orderId,
          name: user?.tenant?.name || 'Subscription',
          description: `${planCode} · ${cycle}`,
          prefill: {
            name: user?.name || user?.displayName || '',
            email: user?.email || '',
            contact: user?.mobile || '',
          },
        });
        await api.post('/billing/confirm', {
          invoiceId: data.invoiceId,
          planCode,
          billingCycle: cycle,
          provider: 'razorpay',
          razorpay_order_id: payment.razorpay_order_id,
          razorpay_payment_id: payment.razorpay_payment_id,
          razorpay_signature: payment.razorpay_signature,
        });
        setMessage(`Upgraded to ${planCode} via Razorpay`);
        await load();
        return;
      }

      if (data.provider === 'cashfree' || data.mode === 'cashfree') {
        await openCashfreeCheckout({
          paymentSessionId: data.paymentSessionId,
          mode: data.cashfreeMode || cashfreeMode,
        });
        await api.post('/billing/confirm', {
          invoiceId: data.invoiceId,
          planCode,
          billingCycle: cycle,
          provider: 'cashfree',
          cashfree_order_id: data.orderId,
        });
        setMessage(`Upgraded to ${planCode} via Cashfree`);
        await load();
        return;
      }

      setMessage('Checkout started, but no supported payment provider response was returned.');
    } catch (err) {
      if (err?.message === 'Payment cancelled') {
        setError('Payment cancelled');
      } else {
        setError(err.response?.data?.message || err.message || 'Checkout failed');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Billing</h1>
        <p className="text-sm text-slate-500">Manage your {user?.tenant?.name || 'workspace'} subscription.</p>
      </div>

      {error && <div className="rounded-md bg-[#fdeaea] px-3 py-2 text-sm text-[#d03b3b]">{error}</div>}
      {message && <div className="rounded-md bg-[#eaf7ea] px-3 py-2 text-sm text-[#0ca30c]">{message}</div>}

      <section className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Current plan</h2>
        <p className="mt-2 text-sm text-slate-600">
          {subscription?.plan?.name || 'Free Trial'} · {subscription?.status || 'trialing'}
          {subscription?.currentPeriodEnd
            ? ` · renews/ends ${formatDate(subscription.currentPeriodEnd, user?.timeZone)}`
            : ''}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div>
            <label className="mr-2 text-xs text-slate-500">Billing cycle</label>
            <select
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
              className="rounded-md border border-brand-200 px-2 py-1 text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="mr-2 text-xs text-slate-500">Pay with</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="rounded-md border border-brand-200 px-2 py-1 text-sm"
            >
              {providers.length === 0 && <option value="dev">Simulated (dev)</option>}
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mr-2 text-xs text-slate-500">Coupon</label>
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="WELCOME20"
              className="rounded-md border border-brand-200 px-2 py-1 text-sm uppercase"
            />
          </div>
        </div>
        {providers.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">
            Add Razorpay and/or Cashfree keys in backend `.env` to enable live checkout.
          </p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan._id} className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-900">{plan.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
            <p className="mt-3 font-display text-2xl text-slate-700">
              {formatMoney(cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly)}
              <span className="text-sm font-sans text-slate-400">/{cycle === 'yearly' ? 'yr' : 'mo'}</span>
            </p>
            <ul className="mt-3 space-y-1 text-xs text-slate-500">
              <li>Users: {plan.limits?.users}</li>
              <li>Modules: {plan.limits?.modules}</li>
              <li>Records: {plan.limits?.records}</li>
              <li>Workflows: {plan.limits?.workflows}</li>
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={() => checkout(plan.code)}
              className="mt-4 w-full rounded-md bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? 'Processing…' : `Choose ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Payment history</div>
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Provider</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv._id} className="border-t border-slate-100">
                <td className="px-4 py-2">{inv.description}</td>
                <td className="px-4 py-2">{formatMoney(inv.amount)}</td>
                <td className="px-4 py-2 capitalize">{inv.provider || '—'}</td>
                <td className="px-4 py-2">{inv.status}</td>
                <td className="px-4 py-2">{formatDate(inv.paidAt || inv.createdAt, user?.timeZone)}</td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No invoices yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
