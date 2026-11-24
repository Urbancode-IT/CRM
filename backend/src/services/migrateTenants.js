const { prisma } = require('../config/db');
const { createTenantForOwner, ensurePlans } = require('./tenantBootstrap');

/**
 * Idempotent check: make sure every user has an active membership/tenant
 * and a valid activeTenantId. (Postgres enforces tenantId, so no orphan stamping is needed.)
 */
async function migrateExistingDataToTenants() {
  await ensurePlans();

  const users = await prisma.user.findMany({
    include: {
      memberships: {
        where: { status: 'active' },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });

  for (const user of users) {
    const membership = user.memberships[0];
    if (!membership) {
      const { memberships, ...userRow } = user;
      const { tenant } = await createTenantForOwner({
        user: userRow,
        name: user.instituteName || `${user.name}'s Institute`,
        businessCategory: 'tuition',
      });
      console.log(`[migrate] created tenant ${tenant.slug} for ${user.email}`);
    } else if (!user.activeTenantId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { activeTenantId: membership.tenantId },
      });
    }
  }

  console.log('[migrate] tenant migration check complete');
}

module.exports = { migrateExistingDataToTenants };
