const crypto = require('crypto');
const { readCsrfCookie } = require('../utils/authCookie');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function timingSafeEqualStr(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Double-submit CSRF: cookie `tusion_csrf` must match header `X-CSRF-Token`
 * on state-changing requests when a session cookie is present.
 */
function csrfProtect(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  // Skip public unauthenticated endpoints that don't use session cookies yet
  const path = req.path || '';
  const full = req.originalUrl || path;
  if (
    full.startsWith('/api/auth/login') ||
    full.startsWith('/api/auth/register') ||
    full.startsWith('/api/auth/refresh') ||
    full.startsWith('/api/auth/logout') ||
    full.startsWith('/api/auth/google') ||
    full.startsWith('/api/auth/otp/') ||
    full.startsWith('/api/auth/mfa/verify') ||
    full.startsWith('/api/auth/invites/') ||
    full.startsWith('/api/public/') ||
    full.startsWith('/api/cron/') ||
    full.startsWith('/api/health') ||
    full.startsWith('/api/billing/webhook')
  ) {
    return next();
  }

  const cookieToken = readCsrfCookie(req);
  // No CSRF cookie yet → unauthenticated mutating call (login already skipped)
  if (!cookieToken) return next();

  const headerToken = req.get('x-csrf-token') || req.get('x-xsrf-token') || '';
  if (!headerToken || !timingSafeEqualStr(cookieToken, headerToken)) {
    res.status(403);
    return next(new Error('CSRF validation failed'));
  }
  return next();
}

module.exports = { csrfProtect };
