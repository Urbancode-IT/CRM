const crypto = require('crypto');
const { prisma } = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const asyncHandler = require('../utils/asyncHandler');
const pick = require('../utils/pick');
const { writeAudit } = require('../utils/audit');
const {
  listSessions,
  revokeSession,
  revokeOtherSessions,
} = require('../services/sessionService');

function currentSessionKey(req) {
  return req.sessionId || null;
}

function backupCodes(count = 8) {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
}

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 8) {
    res.status(400);
    throw new Error('New password must be at least 8 characters.');
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.authProvider === 'local' || user.password) {
    const ok = await comparePassword(currentPassword || '', user.password);
    if (!ok) {
      res.status(400);
      throw new Error('Current password is incorrect.');
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(String(newPassword)),
      authProvider: 'local',
    },
  });
  await revokeOtherSessions(user.id, currentSessionKey(req));

  await writeAudit({
    tenantId: req.tenantId,
    userId: user.id,
    action: 'account.password.change',
    entityType: 'User',
    entityId: user.id,
  });

  res.json({ ok: true, message: 'Password updated. Other sessions were signed out.' });
});

const { generateSecret, verifyTotp, otpauthUrl } = require('../utils/totp');

const beginMfaSetup = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const secret = generateSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: secret, mfaEnabled: false },
  });
  res.json({
    secret,
    otpauthUrl: otpauthUrl({
      secret,
      email: user.email,
      issuer: process.env.SMTP_FROM_NAME || 'Tusion',
    }),
  });
});

const updateMfa = asyncHandler(async (req, res) => {
  const enabled = Boolean(req.body.enabled);
  const code = String(req.body.code || '').trim();
  const existing = await prisma.user.findUnique({ where: { id: req.user.id } });
  let codes = [];
  const data = {};

  if (enabled) {
    const mfaSecret = existing.mfaSecret || generateSecret();
    if (!verifyTotp(mfaSecret, code)) {
      res.status(400);
      throw new Error('Invalid authenticator code. Scan the QR/secret and try again.');
    }
    codes = backupCodes();
    data.mfaSecret = mfaSecret;
    data.mfaBackupCodes = codes.map((c) =>
      crypto.createHash('sha256').update(c).digest('hex')
    );
    data.mfaEnabled = true;
  } else {
    data.mfaEnabled = false;
    data.mfaSecret = '';
    data.mfaBackupCodes = [];
  }
  const user = await prisma.user.update({ where: { id: existing.id }, data });

  await writeAudit({
    tenantId: req.tenantId,
    userId: user.id,
    action: enabled ? 'account.mfa.enable' : 'account.mfa.disable',
    entityType: 'User',
    entityId: user.id,
  });

  res.json({
    ok: true,
    mfaEnabled: user.mfaEnabled,
    // Backup codes are shown once at enable time only; MFA secret stays server-side.
    backupCodes: enabled ? codes : [],
    message: enabled
      ? 'MFA enabled. Save these backup codes somewhere safe.'
      : 'MFA disabled for this account.',
  });
});

const updateAccountSettings = asyncHandler(async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.user.id } });
  const allowed = pick(req.body, [
    'loginAlerts',
    'emailMarketing',
    'shareAnalytics',
    'language',
    'timeZone',
    'secondaryEmail',
    'mobile',
  ]);

  const data = {};
  if (allowed.loginAlerts !== undefined) data.loginAlerts = Boolean(allowed.loginAlerts);
  if (allowed.emailMarketing !== undefined) data.emailMarketing = Boolean(allowed.emailMarketing);
  if (allowed.shareAnalytics !== undefined) data.shareAnalytics = Boolean(allowed.shareAnalytics);
  if (allowed.language !== undefined) data.language = String(allowed.language).trim() || existing.language;
  if (allowed.timeZone !== undefined) data.timeZone = String(allowed.timeZone).trim() || existing.timeZone;
  if (allowed.mobile !== undefined) data.mobile = String(allowed.mobile).trim();
  if (allowed.secondaryEmail !== undefined) {
    data.secondaryEmail = String(allowed.secondaryEmail).trim().toLowerCase();
  }

  const user = Object.keys(data).length
    ? await prisma.user.update({ where: { id: existing.id }, data })
    : existing;

  res.json({
    ok: true,
    settings: {
      loginAlerts: user.loginAlerts !== false,
      emailMarketing: Boolean(user.emailMarketing),
      shareAnalytics: user.shareAnalytics !== false,
      language: user.language,
      timeZone: user.timeZone,
      mobile: user.mobile || '',
      secondaryEmail: user.secondaryEmail || '',
    },
  });
});

const getSessions = asyncHandler(async (req, res) => {
  const sessions = await listSessions(req.user.id, currentSessionKey(req));
  res.json({ sessions });
});

const deleteSession = asyncHandler(async (req, res) => {
  const session = await revokeSession(req.user.id, req.params.id);
  if (!session) {
    res.status(404);
    throw new Error('Session not found');
  }
  res.json({ ok: true });
});

const deleteOtherSessions = asyncHandler(async (req, res) => {
  const count = await revokeOtherSessions(req.user.id, currentSessionKey(req));
  res.json({ ok: true, revoked: count });
});

const getMembers = asyncHandler(async (req, res) => {
  if (!req.tenantId) {
    res.status(400);
    throw new Error('Workspace context required');
  }
  const memberships = await prisma.membership.findMany({
    where: { tenantId: req.tenantId },
    include: {
      user: { select: { id: true, name: true, email: true, displayName: true, role: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json({
    members: memberships.map((m) => ({
      id: m.id,
      _id: m.id,
      role: m.role,
      status: m.status,
      user: m.user
        ? {
            id: m.user.id,
            _id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            displayName: m.user.displayName || m.user.name,
          }
        : null,
      createdAt: m.createdAt,
    })),
  });
});

const exportPrivacyData = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      secondaryEmail: true,
      mobile: true,
      gender: true,
      country: true,
      state: true,
      language: true,
      timeZone: true,
      authProvider: true,
      mfaEnabled: true,
      createdAt: true,
    },
  });
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { tenant: { select: { id: true, name: true, slug: true } } },
  });
  const payload = {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      email: user.email,
      secondaryEmail: user.secondaryEmail,
      mobile: user.mobile,
      gender: user.gender,
      country: user.country,
      state: user.state,
      language: user.language,
      timeZone: user.timeZone,
      authProvider: user.authProvider,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt,
    },
    workspaces: memberships.map((m) => ({
      role: m.role,
      status: m.status,
      tenant: m.tenant ? { id: m.tenant.id, name: m.tenant.name, slug: m.tenant.slug } : null,
    })),
  };
  res.json({ export: payload });
});

const getCompliance = asyncHandler(async (req, res) => {
  const where = { userId: req.user.id };
  if (req.tenantId) where.tenantId = req.tenantId;
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({
    logs: logs.map((l) => ({
      id: l.id,
      _id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      meta: l.meta,
      createdAt: l.createdAt,
    })),
  });
});

module.exports = {
  changePassword,
  beginMfaSetup,
  updateMfa,
  updateAccountSettings,
  getSessions,
  deleteSession,
  deleteOtherSessions,
  getMembers,
  exportPrivacyData,
  getCompliance,
};
