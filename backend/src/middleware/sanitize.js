const xss = require('xss');

const MONGO_OP = /^\$/;

function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return xss(value, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
  }).trim();
}

function stripDangerousKeys(input, depth = 0) {
  if (depth > 8 || input == null) return input;
  if (Array.isArray(input)) {
    return input.map((item) => stripDangerousKeys(item, depth + 1));
  }
  if (typeof input === 'string') return sanitizeString(input);
  if (typeof input !== 'object') return input;
  if (input instanceof Date) return input;

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (MONGO_OP.test(key) || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    out[key] = stripDangerousKeys(value, depth + 1);
  }
  return out;
}

/** Deep-sanitize req.body / query / params against XSS + operator injection. */
function sanitizeRequest(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = stripDangerousKeys(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = stripDangerousKeys(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = stripDangerousKeys(req.params);
  }
  next();
}

module.exports = { sanitizeRequest, sanitizeString, stripDangerousKeys };
