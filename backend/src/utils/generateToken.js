const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function requireJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'change_this_to_a_long_random_secret') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set to a strong value in production');
    }
  }
  return secret || 'dev-only-insecure-secret';
}

function basePayload(user, membership = null) {
  return {
    id: user.id || user._id,
    role: membership?.role || user.role || 'staff',
    tenantId:
      membership?.tenantId ||
      membership?.tenant ||
      user.activeTenantId ||
      user.activeTenant ||
      null,
    isSuperAdmin: Boolean(user.isSuperAdmin),
  };
}

function generateAccessToken(user, membership = null, sessionId) {
  return jwt.sign(
    { ...basePayload(user, membership), sid: sessionId, typ: 'access' },
    requireJwtSecret(),
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
}

function generateRefreshToken(user, sessionId) {
  return jwt.sign(
    {
      id: user.id || user._id,
      sid: sessionId,
      typ: 'refresh',
      jti: crypto.randomBytes(16).toString('hex'),
    },
    requireJwtSecret(),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/** @deprecated Prefer generateAccessToken + generateRefreshToken */
function generateToken(user, membership = null) {
  return generateAccessToken(user, membership, null);
}

function generateMfaToken(userId) {
  return jwt.sign({ id: userId, purpose: 'mfa' }, requireJwtSecret(), {
    expiresIn: '10m',
  });
}

function verifyMfaToken(token) {
  const decoded = jwt.verify(token, requireJwtSecret());
  if (decoded.purpose !== 'mfa') {
    const err = new Error('Invalid MFA token');
    err.statusCode = 401;
    throw err;
  }
  return decoded;
}

function generateParentToken({ parentEmail, tenantId, studentIds }) {
  return jwt.sign(
    { purpose: 'parent', parentEmail, tenantId, studentIds },
    requireJwtSecret(),
    { expiresIn: '7d' }
  );
}

function verifyParentToken(token) {
  const decoded = jwt.verify(token, requireJwtSecret());
  if (decoded.purpose !== 'parent') {
    const err = new Error('Invalid parent token');
    err.statusCode = 401;
    throw err;
  }
  return decoded;
}

function verifyToken(token, { typ } = {}) {
  const decoded = jwt.verify(token, requireJwtSecret());
  if (typ && decoded.typ && decoded.typ !== typ) {
    const err = new Error('Invalid token type');
    err.statusCode = 401;
    throw err;
  }
  return decoded;
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = generateToken;
module.exports.generateToken = generateToken;
module.exports.generateAccessToken = generateAccessToken;
module.exports.generateRefreshToken = generateRefreshToken;
module.exports.generateMfaToken = generateMfaToken;
module.exports.verifyMfaToken = verifyMfaToken;
module.exports.generateParentToken = generateParentToken;
module.exports.verifyParentToken = verifyParentToken;
module.exports.verifyToken = verifyToken;
module.exports.createCsrfToken = createCsrfToken;
module.exports.requireJwtSecret = requireJwtSecret;
