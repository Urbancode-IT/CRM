function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found: ${req.method} ${req.originalUrl}`));
}

function clientSafeMessage(err, statusCode) {
  if (statusCode >= 500) return 'Something went wrong. Please try again.';
  const message = err && typeof err.message === 'string' ? err.message.trim() : '';
  if (!message) return 'Request failed';

  // Hide driver/internal leakage; keep normal validation and auth UX copy
  // (e.g. "Password must be at least 8 characters").
  if (
    /prisma|database|econnrefused|econnreset|etimedout|jwt_secret|mfaSecret|tokenHash|passwordHash|\bstack\b|at Object\./i.test(
      message
    )
  ) {
    return statusCode === 401 ? 'Not authorized' : 'Request failed';
  }
  return message;
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode =
    err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  if (statusCode >= 500) {
    console.error('[api:error]', {
      method: req.method,
      path: req.originalUrl,
      message: err.message,
      code: err.code,
    });
  }

  res.status(statusCode).json({
    message: clientSafeMessage(err, statusCode),
  });
}

module.exports = { notFound, errorHandler };
