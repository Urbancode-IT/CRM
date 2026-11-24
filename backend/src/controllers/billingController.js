const { prisma } = require('../config/db');
const { toApi, toApiList } = require('../utils/toApi');
const asyncHandler = require('../utils/asyncHandler');
const { ensurePlans } = require('../services/tenantBootstrap');
const { writeAudit } = require('../utils/audit');
const {
  listProviders,
  resolveProvider,
  createRazorpayOrder,
  createCashfreeOrder,
  verifyRazorpaySignature,
  verifyCashfreePaid,
  razorpayConfigured,
  cashfreeConfigured,
} = require('../services/paymentProviders');

const INVOICE_WRITABLE_FIELDS = [
  'amount',
  'currency',
  'status',
  'description',
  'provider',
  'razorpayOrderId',
  'razorpayPaymentId',
  'cashfreeOrderId',
  'cashfreePaymentId',
  'cashfreePaymentSessionId',
  'couponCode',
  'discountAmount',
  'paidAt',
  'subscriptionId',
];

/** Persist the in-memory invoice (plain Prisma row) back to the database. */
async function saveInvoice(invoice) {
  const data = {};
  INVOICE_WRITABLE_FIELDS.forEach((key) => {
    if (invoice[key] !== undefined) data[key] = invoice[key];
  });
  const saved = await prisma.invoice.update({ where: { id: invoice.id }, data });
  Object.assign(invoice, saved);
  return invoice;
}

function userIdOf(user) {
  return user?.id ?? user?._id ?? null;
}

async function applyCoupon(plan, amount, couponCode) {
  if (!couponCode) return { amount, discountAmount: 0, couponCode: '' };
  const coupon = await prisma.coupon.findFirst({
    where: {
      code: String(couponCode).toUpperCase().trim(),
      isActive: true,
    },
  });
  if (!coupon) {
    const err = new Error('Invalid coupon code');
    err.statusCode = 400;
    throw err;
  }
  const now = new Date();
  if (coupon.validFrom && coupon.validFrom > now) {
    const err = new Error('Coupon not yet valid');
    err.statusCode = 400;
    throw err;
  }
  if (coupon.validUntil && coupon.validUntil < now) {
    const err = new Error('Coupon expired');
    err.statusCode = 400;
    throw err;
  }
  if (coupon.maxRedemptions && coupon.redeemedCount >= coupon.maxRedemptions) {
    const err = new Error('Coupon redemption limit reached');
    err.statusCode = 400;
    throw err;
  }
  if (coupon.planCodes?.length && !coupon.planCodes.includes(plan.code)) {
    const err = new Error('Coupon not valid for this plan');
    err.statusCode = 400;
    throw err;
  }
  let discountAmount = Number(coupon.discountAmount || 0);
  if (coupon.discountPercent) {
    discountAmount += (amount * Number(coupon.discountPercent)) / 100;
  }
  discountAmount = Math.min(amount, Math.round(discountAmount * 100) / 100);
  return {
    amount: Math.max(0, amount - discountAmount),
    discountAmount,
    couponCode: coupon.code,
    coupon,
  };
}

const getPaymentProviders = asyncHandler(async (_req, res) => {
  res.json(listProviders());
});

const listPlans = asyncHandler(async (req, res) => {
  await ensurePlans();
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ plans: toApiList(plans) });
});

const getSubscription = asyncHandler(async (req, res) => {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: req.tenantId },
    include: { plan: true },
  });
  const invoices = await prisma.invoice.findMany({
    where: { tenantId: req.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json({ subscription: toApi(subscription), invoices: toApiList(invoices) });
});

function periodEnd(cycle) {
  const end = new Date();
  if (cycle === 'yearly') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

const createCheckout = asyncHandler(async (req, res) => {
  const {
    planCode,
    billingCycle = 'monthly',
    provider: requestedProvider,
    couponCode,
  } = req.body;
  const plan = await prisma.plan.findFirst({ where: { code: planCode, isActive: true } });
  if (!plan || plan.code === 'trial') {
    res.status(400);
    throw new Error('Invalid plan');
  }

  const baseAmount = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const priced = await applyCoupon(plan, baseAmount, couponCode);
  const amount = priced.amount;
  const provider = resolveProvider(requestedProvider);

  const invoice = await prisma.invoice.create({
    data: {
      tenantId: req.tenantId,
      amount,
      currency: plan.currency || 'INR',
      status: 'pending',
      description: `${plan.name} (${billingCycle})${priced.couponCode ? ` · ${priced.couponCode}` : ''}`,
      provider,
      couponCode: priced.couponCode,
      discountAmount: priced.discountAmount,
    },
  });

  if (provider === 'dev') {
    invoice.razorpayOrderId = `dev_order_${invoice.id}`;
    await saveInvoice(invoice);
    return res.json({
      mode: 'dev',
      provider: 'dev',
      invoiceId: invoice.id,
      orderId: invoice.razorpayOrderId,
      amount,
      currency: invoice.currency,
      message: 'No payment gateway configured — use confirm to simulate payment',
    });
  }

  if (provider === 'razorpay') {
    try {
      const order = await createRazorpayOrder({
        amount,
        currency: invoice.currency,
        receipt: String(invoice.id),
        notes: { tenantId: String(req.tenantId), planCode, billingCycle },
      });
      invoice.razorpayOrderId = order.orderId;
      await saveInvoice(invoice);
      return res.json({
        ...order,
        provider: 'razorpay',
        invoiceId: invoice.id,
        planCode,
        billingCycle,
      });
    } catch (err) {
      res.status(err.statusCode || 502);
      throw err;
    }
  }

  // Cashfree
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  const orderId = `inv_${invoice.id}`;
  try {
    const order = await createCashfreeOrder({
      orderId,
      amount,
      currency: invoice.currency,
      customer: {
        id: userIdOf(req.user),
        name: req.user.name || req.user.displayName || 'Customer',
        email: req.user.email,
        phone: req.user.mobile,
      },
      returnUrl: `${clientUrl}/app/billing?cf_order_id={order_id}`,
      notes: {
        tenantId: req.tenantId,
        planCode,
        billingCycle,
        invoiceId: invoice.id,
        description: invoice.description,
      },
    });
    invoice.cashfreeOrderId = order.orderId;
    invoice.cashfreePaymentSessionId = order.paymentSessionId || '';
    await saveInvoice(invoice);
    return res.json({
      ...order,
      provider: 'cashfree',
      invoiceId: invoice.id,
      planCode,
      billingCycle,
    });
  } catch (err) {
    res.status(err.statusCode || 502);
    throw err;
  }
});

const confirmPayment = asyncHandler(async (req, res) => {
  const {
    invoiceId,
    planCode,
    billingCycle = 'monthly',
    provider: requestedProvider,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    cashfree_order_id,
  } = req.body;

  const invoice = invoiceId
    ? await prisma.invoice.findFirst({
        where: { id: String(invoiceId), tenantId: req.tenantId },
      })
    : null;
  if (!invoice) {
    res.status(404);
    throw new Error('Invoice not found');
  }

  if (invoice.status === 'paid') {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: req.tenantId },
      include: { plan: true },
    });
    return res.json({ subscription: toApi(subscription), invoice: toApi(invoice) });
  }

  const provider = requestedProvider || invoice.provider || 'dev';

  if (provider === 'razorpay' || (razorpayConfigured() && razorpay_order_id)) {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400);
      throw new Error('Razorpay payment verification details required');
    }
    const ok = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
    if (!ok) {
      res.status(400);
      throw new Error('Invalid Razorpay payment signature');
    }
    invoice.provider = 'razorpay';
    invoice.razorpayOrderId = razorpay_order_id;
    invoice.razorpayPaymentId = razorpay_payment_id;
  } else if (provider === 'cashfree' || (cashfreeConfigured() && (cashfree_order_id || invoice.cashfreeOrderId))) {
    const orderId = cashfree_order_id || invoice.cashfreeOrderId;
    if (!orderId) {
      res.status(400);
      throw new Error('Cashfree order id required');
    }
    try {
      const result = await verifyCashfreePaid(orderId);
      if (!result.paid) {
        res.status(400);
        throw new Error(`Cashfree payment not completed (status: ${result.order?.order_status || 'unknown'})`);
      }
      invoice.provider = 'cashfree';
      invoice.cashfreeOrderId = orderId;
      if (result.paymentId) invoice.cashfreePaymentId = result.paymentId;
    } catch (err) {
      if (err.message?.startsWith('Cashfree payment not completed')) {
        res.status(400);
        throw err;
      }
      res.status(err.statusCode || 502);
      throw err;
    }
  } else if (provider !== 'dev' && (razorpayConfigured() || cashfreeConfigured())) {
    res.status(400);
    throw new Error('Payment verification details required');
  }

  const plan = await prisma.plan.findUnique({ where: { code: planCode || '' } });
  if (!plan) {
    res.status(400);
    throw new Error('Plan not found');
  }

  invoice.status = 'paid';
  invoice.paidAt = new Date();
  await saveInvoice(invoice);

  if (invoice.couponCode) {
    await prisma.coupon.updateMany({
      where: { code: invoice.couponCode },
      data: { redeemedCount: { increment: 1 } },
    });
  }

  const now = new Date();
  const subscription = await prisma.subscription.upsert({
    where: { tenantId: req.tenantId },
    create: {
      tenantId: req.tenantId,
      planId: plan.id,
      status: 'active',
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd(billingCycle),
    },
    update: {
      planId: plan.id,
      status: 'active',
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd(billingCycle),
      cancelAtPeriodEnd: false,
    },
  });

  invoice.subscriptionId = subscription.id;
  await saveInvoice(invoice);

  await writeAudit({
    tenantId: req.tenantId,
    userId: userIdOf(req.user),
    action: 'billing.confirm',
    entityType: 'Subscription',
    entityId: subscription.id,
    meta: { planCode, billingCycle, provider: invoice.provider },
  });

  const populated = await prisma.subscription.findUnique({
    where: { id: subscription.id },
    include: { plan: true },
  });
  res.json({ subscription: toApi(populated), invoice: toApi(invoice) });
});

const cancelSubscription = asyncHandler(async (req, res) => {
  const existing = await prisma.subscription.findUnique({ where: { tenantId: req.tenantId } });
  if (!existing) {
    res.status(404);
    throw new Error('Subscription not found');
  }
  const subscription = await prisma.subscription.update({
    where: { id: existing.id },
    data: { cancelAtPeriodEnd: true },
  });
  res.json({ subscription: toApi(subscription) });
});

const validateCoupon = asyncHandler(async (req, res) => {
  const plan = await prisma.plan.findFirst({
    where: { code: req.body.planCode, isActive: true },
  });
  if (!plan || plan.code === 'trial') {
    res.status(400);
    throw new Error('Invalid plan');
  }
  const billingCycle = req.body.billingCycle || 'monthly';
  const baseAmount = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const priced = await applyCoupon(plan, baseAmount, req.body.couponCode);
  res.json({
    couponCode: priced.couponCode,
    discountAmount: priced.discountAmount,
    originalAmount: baseAmount,
    amount: priced.amount,
  });
});

module.exports = {
  getPaymentProviders,
  listPlans,
  getSubscription,
  createCheckout,
  confirmPayment,
  cancelSubscription,
  validateCoupon,
};
