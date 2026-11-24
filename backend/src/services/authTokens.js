const {
  generateAccessToken,
  generateRefreshToken,
  createCsrfToken,
} = require('../utils/generateToken');
const { setAuthCookies, clearAuthCookies } = require('../utils/authCookie');
const {
  createSession,
  rotateRefreshToken,
  findActiveSessionByRefresh,
  revokeSessionById,
} = require('./sessionService');
const { toApi } = require('../utils/toApi');

async function issueTokenPair(res, user, membership, req, { sessionId } = {}) {
  const apiUser = toApi(user);
  const apiMembership = membership ? toApi(membership) : null;

  let sid = sessionId;
  let refreshToken;

  if (sid) {
    refreshToken = generateRefreshToken(apiUser, sid);
    await rotateRefreshToken(sid, refreshToken);
  } else {
    // Placeholder refresh — create session after we have sid from DB.
    // Create session with temporary hash then rotate once we know id.
    const tempRefresh = generateRefreshToken(apiUser, 'pending');
    const session = await createSession({
      userId: apiUser.id,
      refreshToken: tempRefresh,
      req,
    });
    sid = session.id;
    refreshToken = generateRefreshToken(apiUser, sid);
    await rotateRefreshToken(sid, refreshToken);
  }

  const accessToken = generateAccessToken(apiUser, apiMembership, sid);
  const csrfToken = createCsrfToken();
  setAuthCookies(res, { accessToken, refreshToken, csrfToken });
  return { sessionId: sid, accessToken };
}

async function refreshTokenPair(req, res) {
  const { readRefreshToken } = require('../utils/authCookie');
  const { verifyToken } = require('../utils/generateToken');
  const { prisma } = require('../config/db');

  const refreshToken = readRefreshToken(req);
  if (!refreshToken) {
    const err = new Error('Refresh token missing');
    err.statusCode = 401;
    throw err;
  }

  let decoded;
  try {
    decoded = verifyToken(refreshToken, { typ: 'refresh' });
  } catch {
    clearAuthCookies(res);
    const err = new Error('Invalid refresh token');
    err.statusCode = 401;
    throw err;
  }

  const session = await findActiveSessionByRefresh(refreshToken);
  if (!session || (decoded.sid && session.id !== decoded.sid)) {
    // Possible reuse — revoke family
    if (decoded.sid) await revokeSessionById(decoded.sid);
    clearAuthCookies(res);
    const err = new Error('Session expired. Please sign in again.');
    err.statusCode = 401;
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { id: String(decoded.id) } });
  if (!user) {
    clearAuthCookies(res);
    const err = new Error('User not found');
    err.statusCode = 401;
    throw err;
  }

  let membership = null;
  if (user.activeTenantId) {
    membership = await prisma.membership.findFirst({
      where: { userId: user.id, tenantId: user.activeTenantId, status: 'active' },
    });
  }

  await issueTokenPair(res, user, membership, req, { sessionId: session.id });
  return { user, membership, sessionId: session.id };
}

module.exports = { issueTokenPair, refreshTokenPair };
