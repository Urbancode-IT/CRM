const { prisma } = require('../config/db');
const { toApi } = require('../utils/toApi');
const asyncHandler = require('../utils/asyncHandler');
const { isSessionRevoked, touchSessionById } = require('../services/sessionService');
const { readAccessToken } = require('../utils/authCookie');
const { verifyToken } = require('../utils/generateToken');

const SENSITIVE_USER_FIELDS = ['password', 'mfaSecret', 'mfaBackupCodes'];

function stripSecrets(userRow) {
  if (!userRow) return null;
  const safe = { ...userRow };
  for (const key of SENSITIVE_USER_FIELDS) delete safe[key];
  return safe;
}

const protect = asyncHandler(async (req, res, next) => {
  const token = readAccessToken(req);

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  let decoded;
  try {
    decoded = verifyToken(token);
    if (decoded.typ && decoded.typ !== 'access') {
      res.status(401);
      throw new Error('Not authorized, invalid or expired token');
    }
  } catch (err) {
    if (!res.statusCode || res.statusCode === 200) res.status(401);
    throw new Error('Not authorized, invalid or expired token');
  }

  const userRow = decoded.id
    ? await prisma.user.findUnique({ where: { id: String(decoded.id) } })
    : null;
  if (!userRow) {
    res.status(401);
    throw new Error('Not authorized, user no longer exists');
  }

  const user = stripSecrets(userRow);

  if (user.sessionsInvalidBefore && decoded.iat) {
    if (decoded.iat * 1000 < new Date(user.sessionsInvalidBefore).getTime()) {
      res.status(401);
      throw new Error('Session expired. Please sign in again.');
    }
  }

  if (decoded.sid && (await isSessionRevoked(decoded.sid, user))) {
    res.status(401);
    throw new Error('Session expired. Please sign in again.');
  }

  if (decoded.sid) {
    touchSessionById(decoded.sid).catch(() => {});
  }

  req.user = toApi(user);
  req.authToken = token;
  req.sessionId = decoded.sid || null;
  req.isSuperAdmin = Boolean(user.isSuperAdmin || decoded.isSuperAdmin);

  const tenantId = req.headers['x-tenant-id'] || decoded.tenantId || user.activeTenantId;
  if (tenantId) {
    const membership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
        tenantId: String(tenantId),
        status: 'active',
      },
    });

    if (!membership && !req.isSuperAdmin) {
      res.status(403);
      throw new Error('No access to this workspace');
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: String(tenantId) } });
    if (!tenant || tenant.status === 'cancelled') {
      res.status(403);
      throw new Error('Workspace unavailable');
    }

    // Prevent tenant header spoofing: membership must match requested tenant
    if (membership && String(membership.tenantId) !== String(tenant.id) && !req.isSuperAdmin) {
      res.status(403);
      throw new Error('No access to this workspace');
    }

    req.tenant = toApi(tenant);
    req.membership = membership ? toApi(membership) : null;
    req.tenantId = tenant.id;
    req.memberRole = membership?.role || (req.isSuperAdmin ? 'owner' : 'staff');
  }

  next();
});

const requireTenant = asyncHandler(async (req, res, next) => {
  if (!req.tenantId) {
    res.status(400);
    throw new Error('Workspace context required');
  }
  if (req.tenant?.status === 'suspended' && !req.isSuperAdmin) {
    res.status(403);
    throw new Error('Workspace is suspended');
  }
  next();
});

const requireRole = (...roles) =>
  asyncHandler(async (req, res, next) => {
    if (req.isSuperAdmin) return next();
    if (!req.memberRole || !roles.includes(req.memberRole)) {
      res.status(403);
      throw new Error('Insufficient permissions');
    }
    next();
  });

const requireActiveSubscription = asyncHandler(async (req, res, next) => {
  if (req.isSuperAdmin) return next();
  if (!req.tenantId) return next();

  const sub = await prisma.subscription.findFirst({
    where: { tenantId: req.tenantId },
    include: { plan: true },
  });
  if (!sub) return next();

  const setStatus = async (status) => {
    await prisma.subscription.update({ where: { id: sub.id }, data: { status } });
    sub.status = status;
  };

  req.subscription = toApi(sub);

  if (sub.status === 'trialing') {
    if (req.tenant?.trialEndsAt && new Date(req.tenant.trialEndsAt) < new Date()) {
      await setStatus('expired');
      req.subscription = toApi(sub);
      res.status(402);
      throw new Error('Trial expired. Please upgrade your plan.');
    }
    return next();
  }

  if (sub.status === 'active') {
    if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) {
      await setStatus(sub.cancelAtPeriodEnd ? 'cancelled' : 'past_due');
      req.subscription = toApi(sub);
    } else {
      return next();
    }
  }

  if (sub.status === 'past_due' || sub.status === 'expired' || sub.status === 'cancelled') {
    res.status(402);
    throw new Error('Subscription inactive. Please renew your plan.');
  }

  next();
});

const requireSuperAdmin = asyncHandler(async (req, res, next) => {
  if (!req.isSuperAdmin) {
    res.status(403);
    throw new Error('Super admin access required');
  }
  next();
});

module.exports = {
  protect,
  requireTenant,
  requireRole,
  requireActiveSubscription,
  requireSuperAdmin,
  stripSecrets,
};
