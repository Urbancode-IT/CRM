const { prisma } = require('../config/db');

async function writeAudit({ tenantId, userId, action, entityType, entityId, meta }) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: tenantId ? String(tenantId) : null,
        userId: userId ? String(userId) : null,
        action,
        entityType: entityType || '',
        entityId: entityId ? String(entityId) : '',
        meta: meta || {},
      },
    });
  } catch (err) {
    console.error('[audit] failed', err.message);
  }
}

module.exports = { writeAudit };
