const crypto = require('crypto');
const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const messagingService = require('../services/messagingService');
const emailService = require('../services/emailService');
const { toApi } = require('../utils/toApi');
const { issueTokenPair } = require('../services/authTokens');
const { createTenantForOwner } = require('../services/tenantBootstrap');

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

const requestLoginOtp = asyncHandler(async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  const email = String(req.body.email || '')
    .toLowerCase()
    .trim();
  if (!phone && !email) {
    res.status(400);
    throw new Error('Phone or email is required');
  }

  let user = null;
  if (phone) {
    user = await prisma.user.findFirst({ where: { mobile: phone } });
    if (!user) {
      const digits = phone.replace(/\D/g, '').slice(-10);
      if (digits) {
        user = await prisma.user.findFirst({ where: { mobile: { endsWith: digits } } });
      }
    }
  }
  if (!user && email) user = await prisma.user.findFirst({ where: { email } });

  if (!user) {
    res.status(404);
    throw new Error('No account found for this contact. Register first.');
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const destination = phone
    ? messagingService.normalizePhone(phone)
    : email;

  await prisma.otpChallenge.create({
    data: {
      channel: phone ? 'sms' : 'email',
      destination,
      purpose: 'login',
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      meta: { userId: String(user.id) },
    },
  });

  if (phone) {
    await messagingService.sendSms({ to: phone, body: `Tusion login code: ${code}` });
    await messagingService.sendWhatsApp({ to: phone, body: `Tusion login code: ${code}` });
  } else {
    await emailService.sendOtpEmail(email, { code, purpose: 'login' });
  }

  // Never return OTP codes in API responses — they belong only in SMS/email.
  res.json({
    ok: true,
    message: 'OTP sent',
  });
});

const verifyLoginOtp = asyncHandler(async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  const email = String(req.body.email || '')
    .toLowerCase()
    .trim();
  const code = String(req.body.code || '').trim();
  const destination = phone ? messagingService.normalizePhone(phone) : email;

  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      destination,
      purpose: 'login',
      consumed: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!challenge || challenge.expiresAt < new Date()) {
    res.status(400);
    throw new Error('OTP expired');
  }
  if (challenge.codeHash !== hashCode(code)) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: challenge.attempts + 1 },
    });
    res.status(400);
    throw new Error('Invalid OTP');
  }
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { attempts: challenge.attempts + 1, consumed: true },
  });

  const userId = challenge.meta && challenge.meta.userId;
  const user = userId ? await prisma.user.findUnique({ where: { id: String(userId) } }) : null;
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  let membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: 'active' },
  });
  let tenant = membership
    ? await prisma.tenant.findUnique({ where: { id: membership.tenantId } })
    : null;
  if (!membership && !user.isSuperAdmin) {
    const created = await createTenantForOwner({
      user,
      name: user.instituteName || `${user.name}'s Workspace`,
    });
    membership = created.membership;
    tenant = created.tenant;
  }
  const subscription = membership
    ? await prisma.subscription.findFirst({
        where: { tenantId: membership.tenantId },
        include: { plan: true },
      })
    : null;

  const freshUser = (await prisma.user.findUnique({ where: { id: user.id } })) || user;
  await issueTokenPair(res, freshUser, membership, req);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      onboardingCompleted: user.onboardingCompleted,
      featureIntroSeen: user.featureIntroSeen,
      tenantId: tenant?.id,
      tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
      membershipRole: membership?.role,
      subscription: subscription
        ? {
            status: subscription.status,
            plan: subscription.plan
              ? { code: subscription.plan.code, name: subscription.plan.name, limits: subscription.plan.limits }
              : null,
          }
        : null,
    },
  });
});

module.exports = { requestLoginOtp, verifyLoginOtp };
