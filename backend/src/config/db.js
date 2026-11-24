const { PrismaClient } = require('@prisma/client');

let cached = global.__tuitionPrisma;
if (!cached) {
  cached = global.__tuitionPrisma = { client: null, promise: null };
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

async function connectDB() {
  if (cached.client) return cached.client;

  if (!cached.promise) {
    const client = createPrismaClient();
    cached.promise = client.$connect().then(() => {
      console.log('[db] connected');
      cached.client = client;
      return client;
    });
  }

  return cached.promise;
}

function getPrisma() {
  if (!cached.client) {
    cached.client = createPrismaClient();
  }
  return cached.client;
}

/** Lazy proxy so `const { prisma } = require('../config/db')` always works. */
const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getPrisma();
      const value = client[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  }
);

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.prisma = prisma;
module.exports.getPrisma = getPrisma;
