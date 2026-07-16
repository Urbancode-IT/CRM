// Vercel Cron sends Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
function verifyCron(req, res, next) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';

  if (secret) {
    if (auth === `Bearer ${secret}`) return next();
    return res.status(401).json({ message: 'Unauthorized cron request' });
  }

  // Local/dev without CRON_SECRET — allow so you can hit the routes manually.
  if (process.env.NODE_ENV !== 'production') return next();

  return res.status(401).json({
    message: 'CRON_SECRET is not configured',
  });
}

module.exports = { verifyCron };
