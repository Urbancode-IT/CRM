const ACCESS_COOKIE = 'tusion_access';
const REFRESH_COOKIE = 'tusion_refresh';
const CSRF_COOKIE = 'tusion_csrf';
/** @deprecated legacy single-session cookie */
const LEGACY_AUTH_COOKIE = 'tusion_session';

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function parseDurationMs(raw, fallbackMs) {
  const value = String(raw || '').trim();
  const match = /^(\d+)([smhd])$/i.exec(value);
  if (!match) return fallbackMs;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * (mult[unit] || fallbackMs);
}

function accessMaxAgeMs() {
  return parseDurationMs(process.env.JWT_ACCESS_EXPIRES_IN || '15m', 15 * 60 * 1000);
}

function refreshMaxAgeMs() {
  return parseDurationMs(
    process.env.JWT_REFRESH_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '7d',
    7 * 24 * 60 * 60 * 1000
  );
}

function cookieBase({ httpOnly, maxAgeMs, sameSite = 'Lax' }) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = ['Path=/', `SameSite=${sameSite}`, `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (httpOnly) parts.push('HttpOnly');
  if (isProd) parts.push('Secure');
  return parts;
}

function appendCookie(res, name, value, options) {
  const encoded = value === '' ? '' : encodeURIComponent(value);
  res.append('Set-Cookie', [`${name}=${encoded}`, ...cookieBase(options)].join('; '));
}

function setAuthCookies(res, { accessToken, refreshToken, csrfToken }) {
  appendCookie(res, ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    maxAgeMs: accessMaxAgeMs(),
    sameSite: 'Lax',
  });
  appendCookie(res, REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    maxAgeMs: refreshMaxAgeMs(),
    sameSite: 'Lax',
  });
  // Readable by JS for double-submit CSRF
  appendCookie(res, CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    maxAgeMs: refreshMaxAgeMs(),
    sameSite: 'Strict',
  });
  // Clear legacy cookie if present
  appendCookie(res, LEGACY_AUTH_COOKIE, '', { httpOnly: true, maxAgeMs: 0, sameSite: 'Lax' });
}

function clearAuthCookies(res) {
  appendCookie(res, ACCESS_COOKIE, '', { httpOnly: true, maxAgeMs: 0, sameSite: 'Lax' });
  appendCookie(res, REFRESH_COOKIE, '', { httpOnly: true, maxAgeMs: 0, sameSite: 'Lax' });
  appendCookie(res, CSRF_COOKIE, '', { httpOnly: false, maxAgeMs: 0, sameSite: 'Strict' });
  appendCookie(res, LEGACY_AUTH_COOKIE, '', { httpOnly: true, maxAgeMs: 0, sameSite: 'Lax' });
}

function readAccessToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  const cookies = parseCookies(req);
  return cookies[ACCESS_COOKIE] || cookies[LEGACY_AUTH_COOKIE] || null;
}

function readRefreshToken(req) {
  return parseCookies(req)[REFRESH_COOKIE] || null;
}

function readCsrfCookie(req) {
  return parseCookies(req)[CSRF_COOKIE] || null;
}

/** Back-compat aliases */
function setAuthCookie(res, token) {
  // Used by older call sites — treat as access-only (prefer setAuthCookies).
  appendCookie(res, ACCESS_COOKIE, token, {
    httpOnly: true,
    maxAgeMs: accessMaxAgeMs(),
    sameSite: 'Lax',
  });
}

function clearAuthCookie(res) {
  clearAuthCookies(res);
}

function readAuthToken(req) {
  return readAccessToken(req);
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  AUTH_COOKIE: ACCESS_COOKIE,
  parseCookies,
  accessMaxAgeMs,
  refreshMaxAgeMs,
  setAuthCookies,
  clearAuthCookies,
  readAccessToken,
  readRefreshToken,
  readCsrfCookie,
  setAuthCookie,
  clearAuthCookie,
  readAuthToken,
  cookieMaxAgeMs: refreshMaxAgeMs,
};
