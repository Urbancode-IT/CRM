function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found: ${req.method} ${req.originalUrl}`));
}

function clientSafeMessage(err, statusCode) {
  if (statusCode >= 500) return 'Something went wrong. Please try again.';
  if (err && typeof err.message === 'string' && err.message.trim()) {
    // Avoid leaking Prisma/internal driver/secret details to clients
    if (
      /prisma|database|econn|timeout|jwt_secret|secret|stack|password|mfaSecret|tokenHash/i.test(
        err.message
      )
    ) {
      return statusCode === 401 ? 'Not authorized' : 'Request failed';
    }
    return err.message;
  }
  return 'Request failed';
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
