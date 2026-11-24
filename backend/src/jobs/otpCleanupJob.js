const { prisma } = require('../config/db');

/** Delete expired OTP challenges (Postgres has no TTL indexes). */
async function cleanupExpiredOtps() {
  const result = await prisma.otpChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  if (result.count > 0) {
    console.log(`[otp-cleanup] removed ${result.count} expired challenge(s)`);
  }
  return result.count;
}

module.exports = { cleanupExpiredOtps };
