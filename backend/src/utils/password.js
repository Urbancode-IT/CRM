const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

async function hashPassword(plain) {
  if (!plain) return null;
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function comparePassword(plain, hashed) {
  if (!hashed) return false;
  return bcrypt.compare(plain, hashed);
}

module.exports = { hashPassword, comparePassword };
