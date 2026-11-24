const crypto = require('crypto');
const { prisma } = require('../config/db');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function deviceLabel(userAgent = '') {
  const ua = String(userAgent);
  if (/Edg\//i.test(ua)) return 'Microsoft Edge';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  if (/Mobile/i.test(ua)) return 'Mobile browser';
  return 'Web session';
}

function requestMeta(req) {
  const userAgent = req?.headers?.['user-agent'] || '';
  const ip =
    (req?.headers?.['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
    req?.socket?.remoteAddress ||
    '';
  return { userAgent, ip, label: deviceLabel(userAgent) };
}

async function createSession({ userId, refreshToken, req }) {
  const meta = requestMeta(req);
  return prisma.session.create({
    data: {
      userId: String(userId),
      tokenHash: hashToken(refreshToken),
      userAgent: meta.userAgent,
      ip: meta.ip,
      label: meta.label,
      lastActiveAt: new Date(),
    },
  });
}

async function rotateRefreshToken(sessionId, newRefreshToken) {
  return prisma.session.update({
    where: { id: String(sessionId) },
    data: {
      tokenHash: hashToken(newRefreshToken),
      lastActiveAt: new Date(),
    },
  });
}

async function findActiveSessionByRefresh(refreshToken) {
  if (!refreshToken) return null;
  return prisma.session.findFirst({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
  });
}

async function findActiveSessionById(sessionId) {
  if (!sessionId) return null;
  return prisma.session.findFirst({
    where: { id: String(sessionId), revokedAt: null },
  });
}

async function touchSessionById(sessionId) {
  if (!sessionId) return;
  await prisma.session.updateMany({
    where: { id: String(sessionId), revokedAt: null },
    data: { lastActiveAt: new Date() },
  });
}

async function listSessions(userId, currentSessionId) {
  const rows = await prisma.session.findMany({
    where: { userId: String(userId), revokedAt: null },
    orderBy: { lastActiveAt: 'desc' },
    take: 30,
  });
  return rows.map((s) => ({
    id: s.id,
    _id: s.id,
    label: s.label || 'Web session',
    ip: s.ip || '',
    userAgent: s.userAgent || '',
    lastActiveAt: s.lastActiveAt,
    createdAt: s.createdAt,
    current: Boolean(currentSessionId && s.id === currentSessionId),
  }));
}

async function revokeSession(userId, sessionId) {
  const session = await prisma.session.findFirst({
    where: { id: String(sessionId), userId: String(userId), revokedAt: null },
  });
  if (!session) return null;
  return prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });
}

async function revokeSessionById(sessionId) {
  if (!sessionId) return null;
  return prisma.session.updateMany({
    where: { id: String(sessionId), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function revokeOtherSessions(userId, currentSessionId) {
  const where = { userId: String(userId), revokedAt: null };
  if (currentSessionId) where.id = { not: String(currentSessionId) };
  const result = await prisma.session.updateMany({
    where,
    data: { revokedAt: new Date() },
  });
  return result.count || 0;
}

async function isSessionRevoked(sessionId, user) {
  if (user?.sessionsInvalidBefore) {
    // callers should also check JWT iat vs sessionsInvalidBefore
  }
  if (!sessionId) return false; // legacy tokens without sid
  const session = await prisma.session.findUnique({ where: { id: String(sessionId) } });
  if (!session) return true;
  return Boolean(session.revokedAt);
}

/** @deprecated use isSessionRevoked */
async function isTokenRevoked(token, user) {
  if (!token) return true;
  if (user?.sessionsInvalidBefore) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      if (decoded?.iat && decoded.iat * 1000 < new Date(user.sessionsInvalidBefore).getTime()) {
        return true;
      }
      if (decoded?.sid) return isSessionRevoked(decoded.sid, user);
    } catch {
      /* ignore */
    }
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    if (decoded?.sid) return isSessionRevoked(decoded.sid, user);
  } catch {
    /* ignore */
  }
  // Legacy: token hash stored directly
  const session = await prisma.session.findFirst({ where: { tokenHash: hashToken(token) } });
  if (!session) return false;
  return Boolean(session.revokedAt);
}

async function touchSession(token) {
  if (!token) return;
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    if (decoded?.sid) return touchSessionById(decoded.sid);
  } catch {
    /* ignore */
  }
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { lastActiveAt: new Date() },
  });
}

module.exports = {
  hashToken,
  createSession,
  rotateRefreshToken,
  findActiveSessionByRefresh,
  findActiveSessionById,
  touchSessionById,
  touchSession,
  listSessions,
  revokeSession,
  revokeSessionById,
  revokeOtherSessions,
  isSessionRevoked,
  isTokenRevoked,
};
