const { prisma } = require('../config/db');
const { toApi } = require('../utils/toApi');

const COUNTERS = {
  users: async (tenantId) =>
    prisma.membership.count({
      where: { tenantId, status: { in: ['active', 'invited'] } },
    }),
  // Only user-created custom modules count toward plan limits (not Students/Payments/etc.).
  modules: async (tenantId) =>
    prisma.customModule.count({ where: { tenantId, isSystem: false } }),
  records: async (tenantId) => prisma.record.count({ where: { tenantId } }),
  workflows: async (tenantId) => prisma.workflow.count({ where: { tenantId } }),
  forms: async (tenantId) => prisma.form.count({ where: { tenantId } }),
  batches: async (tenantId) => prisma.batch.count({ where: { tenantId } }),
};

async function getPlanLimits(tenantId) {
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
  const limits = sub?.plan?.limits || {
    users: 3,
    modules: 8,
    records: 200,
    workflows: 2,
    forms: 5,
    batches: 10,
  };
  return { subscription: toApi(sub), limits };
}

async function assertWithinLimit(tenantId, resource, { extra = 1 } = {}) {
  const counter = COUNTERS[resource];
  if (!counter) return { ok: true };

  const { limits } = await getPlanLimits(tenantId);
  const limit = Number(limits?.[resource]);
  if (!Number.isFinite(limit) || limit < 0) return { ok: true };

  const used = await counter(tenantId);
  if (used + extra > limit) {
    const err = new Error(
      `Plan limit reached for ${resource} (${used}/${limit}). Upgrade your plan to continue.`
    );
    err.statusCode = 402;
    err.code = 'PLAN_LIMIT';
    err.meta = { resource, used, limit };
    throw err;
  }
  return { ok: true, used, limit };
}

module.exports = { assertWithinLimit, getPlanLimits, COUNTERS };
