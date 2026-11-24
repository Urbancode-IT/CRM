/**
 * SaaS billing gateways: Razorpay + Cashfree.
 * Leave keys empty to fall back to simulated (dev) checkout.
 */

function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function cashfreeConfigured() {
  return Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
}

function cashfreeBaseUrl() {
  const env = (process.env.CASHFREE_ENV || 'sandbox').toLowerCase();
  return env === 'production'
    ? 'https://api.cashfree.com'
    : 'https://sandbox.cashfree.com';
}

function cashfreeMode() {
  return (process.env.CASHFREE_ENV || 'sandbox').toLowerCase() === 'production'
    ? 'production'
    : 'sandbox';
}

function listProviders() {
  const providers = [];
  if (razorpayConfigured()) providers.push({ id: 'razorpay', name: 'Razorpay' });
  if (cashfreeConfigured()) providers.push({ id: 'cashfree', name: 'Cashfree' });
  return {
    providers,
    defaultProvider: providers[0]?.id || 'dev',
    cashfreeMode: cashfreeMode(),
  };
}

function resolveProvider(requested) {
  const want = String(requested || '').toLowerCase();
  if (want === 'razorpay' && razorpayConfigured()) return 'razorpay';
  if (want === 'cashfree' && cashfreeConfigured()) return 'cashfree';
  if (want === 'dev') return 'dev';
  if (razorpayConfigured()) return 'razorpay';
  if (cashfreeConfigured()) return 'cashfree';
  return 'dev';
}

async function createRazorpayOrder({ amount, currency, receipt, notes }) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency,
      receipt,
      notes,
    }),
  });

  if (!orderRes.ok) {
    const text = await orderRes.text();
    const err = new Error(`Razorpay order failed: ${text}`);
    err.statusCode = 502;
    throw err;
  }

  const order = await orderRes.json();
  return {
    mode: 'razorpay',
    orderId: order.id,
    amount,
    currency,
    keyId,
  };
}

function normalizePhone(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return '9999999999';
}

async function createCashfreeOrder({
  orderId,
  amount,
  currency,
  customer,
  returnUrl,
  notes,
}) {
  const appId = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  const body = {
    order_id: orderId,
    order_amount: Number(amount),
    order_currency: currency || 'INR',
    customer_details: {
      customer_id: String(customer.id).slice(0, 50),
      customer_name: customer.name || 'Customer',
      customer_email: customer.email || 'billing@example.com',
      customer_phone: normalizePhone(customer.phone),
    },
    order_meta: {
      return_url: returnUrl,
    },
    order_note: notes?.description || 'Subscription',
    order_tags: {
      tenantId: String(notes?.tenantId || ''),
      planCode: String(notes?.planCode || ''),
      billingCycle: String(notes?.billingCycle || ''),
      invoiceId: String(notes?.invoiceId || ''),
    },
  };

  const orderRes = await fetch(`${cashfreeBaseUrl()}/pg/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-version': '2023-08-01',
      'x-client-id': appId,
      'x-client-secret': secret,
    },
    body: JSON.stringify(body),
  });

  if (!orderRes.ok) {
    const text = await orderRes.text();
    const err = new Error(`Cashfree order failed: ${text}`);
    err.statusCode = 502;
    throw err;
  }

  const order = await orderRes.json();
  return {
    mode: 'cashfree',
    orderId: order.order_id,
    paymentSessionId: order.payment_session_id,
    amount,
    currency: order.order_currency || currency,
    cashfreeMode: cashfreeMode(),
  };
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const crypto = require('crypto');
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

async function fetchCashfreeOrder(orderId) {
  const appId = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  const res = await fetch(`${cashfreeBaseUrl()}/pg/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: {
      'x-api-version': '2023-08-01',
      'x-client-id': appId,
      'x-client-secret': secret,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Cashfree order lookup failed: ${text}`);
    err.statusCode = 502;
    throw err;
  }

  return res.json();
}

async function fetchCashfreePayments(orderId) {
  const appId = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  const res = await fetch(
    `${cashfreeBaseUrl()}/pg/orders/${encodeURIComponent(orderId)}/payments`,
    {
      method: 'GET',
      headers: {
        'x-api-version': '2023-08-01',
        'x-client-id': appId,
        'x-client-secret': secret,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Cashfree payments lookup failed: ${text}`);
    err.statusCode = 502;
    throw err;
  }

  return res.json();
}

async function verifyCashfreePaid(orderId) {
  const order = await fetchCashfreeOrder(orderId);
  if (order.order_status !== 'PAID') {
    return { paid: false, order, paymentId: '' };
  }

  let paymentId = '';
  try {
    const payments = await fetchCashfreePayments(orderId);
    const list = Array.isArray(payments) ? payments : [];
    const success = list.find((p) => p.payment_status === 'SUCCESS') || list[0];
    paymentId = success?.cf_payment_id ? String(success.cf_payment_id) : '';
  } catch {
    // Order PAID is enough; payment id is optional metadata.
  }

  return { paid: true, order, paymentId };
}

module.exports = {
  listProviders,
  resolveProvider,
  razorpayConfigured,
  cashfreeConfigured,
  createRazorpayOrder,
  createCashfreeOrder,
  verifyRazorpaySignature,
  verifyCashfreePaid,
  cashfreeMode,
};
