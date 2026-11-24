const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { prisma } = require('../config/db');
const { toApi } = require('../utils/toApi');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateMfaToken, verifyMfaToken } = require('../utils/generateToken');
const asyncHandler = require('../utils/asyncHandler');
const { loadSampleData } = require('../services/demoDataService');
const { createTenantForOwner, ensurePlans } = require('../services/tenantBootstrap');
const { writeAudit } = require('../utils/audit');
const { revokeSessionById } = require('../services/sessionService');
const { clearAuthCookies, readAccessToken } = require('../utils/authCookie');
const { issueTokenPair, refreshTokenPair } = require('../services/authTokens');
const pick = require('../utils/pick');
const { verifyTotp } = require('../utils/totp');

async function issueAuthResponse(res, user, membership, tenant, subscription, req, status = 200) {
  try {
    await issueTokenPair(res, user, membership, req);
  } catch (err) {
    console.error('[session] create failed', err.message);
    clearAuthCookies(res);
    res.status(500);
    throw new Error('Could not create secure session');
  }
  // Tokens live only in httpOnly cookies — never return JWT/password secrets in JSON.
  res.status(status).json({
    user: toPublicUser(user, membership, tenant, subscription),
  });
}

const logout = asyncHandler(async (req, res) => {
  try {
    const token = readAccessToken(req);
    if (token) {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      if (decoded?.sid) await revokeSessionById(decoded.sid);
    }
  } catch {
    /* ignore */
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

const refreshSession = asyncHandler(async (req, res) => {
  const { user, membership } = await refreshTokenPair(req, res);
  let tenant = null;
  let subscription = null;
  if (membership?.tenantId) {
    tenant = await prisma.tenant.findUnique({ where: { id: membership.tenantId } });
    subscription = await findSubscriptionWithPlan(membership.tenantId);
  }
  res.json({ user: toPublicUser(user, membership, tenant, subscription) });
});

function getGoogleClient() {
  if (!process.env.GOOGLE_CLIENT_ID) return null;
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
}

function toPublicUser(user, membership = null, tenant = null, subscription = null) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: membership?.role || user.role,
    isSuperAdmin: Boolean(user.isSuperAdmin),
    onboardingCompleted: Boolean(user.onboardingCompleted),
    featureIntroSeen: Boolean(user.featureIntroSeen),
    instituteName: user.instituteName || tenant?.name || '',
    studentCount: user.studentCount ?? null,
    timeZone: user.timeZone || tenant?.settings?.timeZone || 'Asia/Kolkata',
    language: user.language || tenant?.settings?.language || 'en-US',
    currencyLocale: user.currencyLocale || tenant?.settings?.currencyLocale || 'India',
    displayName: user.displayName || user.name || '',
    gender: user.gender || '',
    country: user.country || 'India',
    state: user.state || '',
    mobile: user.mobile || '',
    secondaryEmail: user.secondaryEmail || '',
    avatarUrl: user.avatarUrl || '',
    authProvider: user.authProvider || 'local',
    mfaEnabled: Boolean(user.mfaEnabled),
    loginAlerts: user.loginAlerts !== false,
    emailMarketing: Boolean(user.emailMarketing),
    shareAnalytics: user.shareAnalytics !== false,
    tenantId: tenant?.id || user.activeTenantId || null,
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          businessCategory: tenant.businessCategory,
          branding: tenant.branding,
          settings: tenant.settings,
          status: tenant.status,
          trialEndsAt: tenant.trialEndsAt,
        }
      : null,
    membershipRole: membership?.role || null,
    subscription: subscription
      ? {
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          currentPeriodEnd: subscription.currentPeriodEnd,
          plan: subscription.plan
            ? {
                id: subscription.plan.id || subscription.planId,
                code: subscription.plan.code,
                name: subscription.plan.name,
                limits: subscription.plan.limits,
              }
            : null,
        }
      : null,
  };
}

function findSubscriptionWithPlan(tenantId) {
  return prisma.subscription.findFirst({
    where: { tenantId },
    include: { plan: true },
  });
}

async function resolveMembershipContext(user, preferredTenantId = null) {
  const tenantId = preferredTenantId || user.activeTenantId;
  let membership = null;
  if (tenantId) {
    membership = await prisma.membership.findFirst({
      where: { userId: user.id, tenantId, status: 'active' },
    });
  }
  if (!membership) {
    membership = await prisma.membership.findFirst({
      where: { userId: user.id, status: 'active' },
      orderBy: { createdAt: 'asc' },
    });
  }
  let tenant = null;
  let subscription = null;
  if (membership) {
    tenant = await prisma.tenant.findUnique({ where: { id: membership.tenantId } });
    subscription = await findSubscriptionWithPlan(membership.tenantId);
    if (String(user.activeTenantId) !== String(membership.tenantId)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { activeTenantId: membership.tenantId },
      });
      user.activeTenantId = membership.tenantId;
      if ('activeTenant' in user) user.activeTenant = membership.tenantId;
    }
  }
  return { membership, tenant, subscription };
}

const register = asyncHandler(async (req, res) => {
  await ensurePlans();
  const { name, email, password, businessName, businessCategory } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email, and password are required');
  }
  if (String(password).length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  const exists = await prisma.user.findFirst({ where: { email: String(email).toLowerCase() } });
  if (exists) {
    res.status(400);
    throw new Error('Email already registered');
  }

  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      password: await hashPassword(password),
      role: 'admin',
      instituteName: (businessName || '').trim(),
    },
  });

  const { tenant, membership } = await createTenantForOwner({
    user,
    name: businessName || `${name}'s Workspace`,
    businessCategory: businessCategory || 'tuition',
  });

  const subscription = await findSubscriptionWithPlan(tenant.id);
  await writeAudit({
    tenantId: tenant.id,
    userId: user.id,
    action: 'tenant.register',
    entityType: 'Tenant',
    entityId: tenant.id,
  });

  const freshUser = (await prisma.user.findUnique({ where: { id: user.id } })) || user;
  await issueAuthResponse(res, freshUser, membership, tenant, subscription, req, 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findFirst({ where: { email: (email || '').toLowerCase() } });

  if (!user || !(await comparePassword(password, user.password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (user.mfaEnabled) {
    return res.json({
      mfaRequired: true,
      mfaToken: generateMfaToken(user.id),
      message: 'Enter the code from your authenticator app',
    });
  }

  let { membership, tenant, subscription } = await resolveMembershipContext(user);

  if (!membership && !user.isSuperAdmin) {
    const created = await createTenantForOwner({
      user,
      name: user.instituteName || `${user.name}'s Workspace`,
    });
    membership = created.membership;
    tenant = created.tenant;
    subscription = await findSubscriptionWithPlan(tenant.id);
  }

  await issueAuthResponse(res, user, membership, tenant, subscription, req);
});

const verifyMfaLogin = asyncHandler(async (req, res) => {
  const { mfaToken, code } = req.body;
  if (!mfaToken || !code) {
    res.status(400);
    throw new Error('MFA token and code are required');
  }

  let decoded;
  try {
    decoded = verifyMfaToken(mfaToken);
  } catch {
    res.status(401);
    throw new Error('MFA session expired. Sign in again.');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || !user.mfaEnabled) {
    res.status(401);
    throw new Error('MFA is not enabled for this account');
  }

  const normalized = String(code).trim().toUpperCase().replace(/\s/g, '');
  let ok = verifyTotp(user.mfaSecret, normalized);
  if (!ok) {
    const hash = crypto.createHash('sha256').update(normalized).digest('hex');
    const backupCodes = [...(user.mfaBackupCodes || [])];
    const idx = backupCodes.indexOf(hash);
    if (idx >= 0) {
      backupCodes.splice(idx, 1);
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaBackupCodes: backupCodes },
      });
      user.mfaBackupCodes = backupCodes;
      ok = true;
    }
  }
  if (!ok) {
    res.status(400);
    throw new Error('Invalid MFA code');
  }

  let { membership, tenant, subscription } = await resolveMembershipContext(user);
  await issueAuthResponse(res, user, membership, tenant, subscription, req);
});

const googleConfig = asyncHandler(async (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  res.json({
    enabled: Boolean(clientId),
    clientId,
  });
});

const googleLogin = asyncHandler(async (req, res) => {
  await ensurePlans();
  const { credential } = req.body;
  if (!credential) {
    res.status(400);
    throw new Error('Google credential is required');
  }
  const googleClient = getGoogleClient();
  if (!googleClient) {
    res.status(503);
    throw new Error('Google Sign-In is not configured. Set GOOGLE_CLIENT_ID on the server.');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) {
    res.status(401);
    throw new Error('Google account email is not verified');
  }

  const email = String(payload.email).toLowerCase().trim();
  const googleId = payload.sub;
  const name = (payload.name || email.split('@')[0] || 'User').trim();
  const avatarUrl = payload.picture || '';

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId }, { email }] },
  });
  let isNew = false;

  if (!user) {
    isNew = true;
    user = await prisma.user.create({
      data: {
        name,
        email,
        password: await hashPassword(crypto.randomBytes(32).toString('hex')),
        authProvider: 'google',
        googleId,
        avatarUrl,
        role: 'admin',
      },
    });
  } else {
    const data = {};
    if (!user.googleId) data.googleId = googleId;
    if (avatarUrl && !user.avatarUrl) data.avatarUrl = avatarUrl;
    if (user.authProvider !== 'google' && !user.password) data.authProvider = 'google';
    if (Object.keys(data).length) {
      user = await prisma.user.update({ where: { id: user.id }, data });
    }
  }

  let { membership, tenant, subscription } = await resolveMembershipContext(user);

  if (!membership && !user.isSuperAdmin) {
    const created = await createTenantForOwner({
      user,
      name: user.instituteName || `${user.name}'s Workspace`,
      businessCategory: 'tuition',
    });
    membership = created.membership;
    tenant = created.tenant;
    subscription = await findSubscriptionWithPlan(tenant.id);
    if (isNew) {
      await writeAudit({
        tenantId: tenant.id,
        userId: user.id,
        action: 'tenant.register.google',
        entityType: 'Tenant',
        entityId: tenant.id,
      });
    }
  }

  if (user.mfaEnabled) {
    return res.json({
      mfaRequired: true,
      mfaToken: generateMfaToken(user.id),
      message: 'Enter the code from your authenticator app',
    });
  }

  const freshUser = (await prisma.user.findUnique({ where: { id: user.id } })) || user;
  await issueAuthResponse(res, freshUser, membership, tenant, subscription, req);
});

const me = asyncHandler(async (req, res) => {
  const { membership, tenant, subscription } = await resolveMembershipContext(
    req.user,
    req.tenantId
  );
  res.json({ user: toPublicUser(req.user, membership, tenant, subscription) });
});

const completeOnboarding = asyncHandler(async (req, res) => {
  const {
    instituteName,
    studentCount,
    timeZone,
    language,
    currencyLocale,
    loadSampleData: shouldLoadSample,
    businessCategory,
  } = req.body;

  const name = (instituteName || '').trim();
  if (!name) {
    res.status(400);
    throw new Error('Institute Name cannot be empty.');
  }

  let parsedCount = null;
  if (studentCount !== undefined && studentCount !== null && studentCount !== '') {
    parsedCount = Number(studentCount);
    if (Number.isNaN(parsedCount) || parsedCount < 0) {
      res.status(400);
      throw new Error('Student Count must be a valid number.');
    }
  }

  let user = await prisma.user.findUnique({ where: { id: req.user.id } });
  let { membership, tenant } = await resolveMembershipContext(user, req.tenantId);

  if (!tenant) {
    const created = await createTenantForOwner({ user, name, businessCategory });
    tenant = created.tenant;
    membership = created.membership;
  } else {
    const tenantData = {
      name,
      settings: {
        ...(tenant.settings || {}),
        timeZone: timeZone || tenant.settings?.timeZone || 'Asia/Kolkata',
        language: language || tenant.settings?.language || 'en-US',
        currencyLocale: currencyLocale || tenant.settings?.currencyLocale || 'India',
      },
    };
    if (businessCategory) tenantData.businessCategory = businessCategory;
    tenant = await prisma.tenant.update({ where: { id: tenant.id }, data: tenantData });
  }

  user = await prisma.user.update({
    where: { id: user.id },
    data: {
      instituteName: name,
      studentCount: parsedCount,
      timeZone: timeZone || 'Asia/Kolkata',
      language: language || 'en-US',
      currencyLocale: currencyLocale || 'India',
      onboardingCompleted: true,
      activeTenantId: tenant.id,
    },
  });

  let sampleData = null;
  if (shouldLoadSample) {
    sampleData = await loadSampleData(tenant.id);
  }

  const subscription = await findSubscriptionWithPlan(tenant.id);
  res.json({
    user: toPublicUser(user, membership, tenant, subscription),
    sampleData,
  });
});

const dismissFeatureIntro = asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { featureIntroSeen: true },
  });
  const { membership, tenant, subscription } = await resolveMembershipContext(user, req.tenantId);
  res.json({ user: toPublicUser(user, membership, tenant, subscription) });
});

const updateProfile = asyncHandler(async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!existing) {
    res.status(404);
    throw new Error('User not found');
  }

  const allowed = pick(req.body, [
    'name',
    'displayName',
    'gender',
    'country',
    'state',
    'language',
    'timeZone',
    'mobile',
    'currencyLocale',
  ]);

  const data = {};
  if (allowed.name !== undefined) {
    const name = String(allowed.name).trim();
    if (!name) {
      res.status(400);
      throw new Error('Full name is required.');
    }
    data.name = name;
  }
  if (allowed.displayName !== undefined) data.displayName = String(allowed.displayName).trim();
  if (allowed.gender !== undefined) data.gender = String(allowed.gender).trim();
  if (allowed.country !== undefined) data.country = String(allowed.country).trim();
  if (allowed.state !== undefined) data.state = String(allowed.state).trim();
  if (allowed.language !== undefined) data.language = String(allowed.language).trim() || 'en-US';
  if (allowed.timeZone !== undefined) data.timeZone = String(allowed.timeZone).trim() || 'Asia/Kolkata';
  if (allowed.mobile !== undefined) data.mobile = String(allowed.mobile).trim();
  if (allowed.currencyLocale !== undefined) {
    data.currencyLocale = String(allowed.currencyLocale).trim() || 'India';
  }

  const user = Object.keys(data).length
    ? await prisma.user.update({ where: { id: existing.id }, data })
    : existing;
  const { membership, tenant, subscription } = await resolveMembershipContext(user, req.tenantId);
  res.json({ user: toPublicUser(user, membership, tenant, subscription) });
});

const updateTenantSettings = asyncHandler(async (req, res) => {
  if (!req.tenant) {
    res.status(400);
    throw new Error('Workspace required');
  }
  const allowed = pick(req.body, ['name', 'businessCategory', 'branding', 'settings']);
  const data = {};
  if (allowed.name) data.name = String(allowed.name).trim();
  if (allowed.businessCategory) data.businessCategory = allowed.businessCategory;
  if (allowed.branding) {
    data.branding = { ...(req.tenant.branding || {}), ...allowed.branding };
  }
  if (allowed.settings) {
    data.settings = { ...(req.tenant.settings || {}), ...allowed.settings };
  }

  const tenant = Object.keys(data).length
    ? await prisma.tenant.update({ where: { id: req.tenant.id }, data })
    : req.tenant;

  if (allowed.name) {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { instituteName: tenant.name },
    });
    req.user.instituteName = tenant.name;
  }

  res.json({ tenant: toApi(tenant) });
});

module.exports = {
  register,
  login,
  logout,
  refreshSession,
  verifyMfaLogin,
  googleConfig,
  googleLogin,
  me,
  updateProfile,
  completeOnboarding,
  dismissFeatureIntro,
  updateTenantSettings,
};
