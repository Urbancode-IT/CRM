const { prisma } = require('../config/db');
const slugify = require('../utils/slugify');

const HIDDEN_NAV_PATHS = [];

const DEFAULT_NAV_SECTIONS = [
  { name: 'Home', path: '/app', order: 0 },
  { name: 'Students', path: '/app/students', order: 1 },
  { name: 'Batches', path: '/app/batches', order: 2 },
  { name: 'Instructors', path: '/app/instructors', order: 3 },
  { name: 'Attendance', path: '/app/attendance', order: 4 },
  { name: 'Payments', path: '/app/payments', order: 5 },
  { name: 'Tasks', path: '/app/tasks', order: 6 },
  { name: 'Modules', path: '/app/modules', order: 7 },
  { name: 'Forms', path: '/app/forms', order: 8 },
  { name: 'Workflows', path: '/app/workflows', order: 9 },
  { name: 'Reports', path: '/app/reports', order: 10 },
  { name: 'Messages', path: '/app/messages', order: 11 },
  { name: 'Recycle Bin', path: '/app/recycle-bin', order: 12 },
  { name: 'Billing', path: '/app/billing', order: 13 },
];

const SYSTEM_CUSTOM_MODULES = [
  { name: 'Students', slug: 'students', systemKey: 'students', order: 0 },
  { name: 'Payments', slug: 'payments', systemKey: 'payments', order: 1 },
  { name: 'Attendance', slug: 'attendance', systemKey: 'attendance', order: 2 },
  { name: 'Tasks', slug: 'tasks', systemKey: 'tasks', order: 3 },
  { name: 'Instructors', slug: 'instructors', systemKey: 'instructors', order: 4 },
];

async function ensurePlans() {
  const defaults = [
    {
      code: 'trial',
      name: 'Free Trial',
      description: '14-day trial for new workspaces',
      priceMonthly: 0,
      priceYearly: 0,
      limits: { users: 3, modules: 8, records: 200, workflows: 2, forms: 5, batches: 5 },
      features: ['core_crm', 'forms', 'parent_portal'],
      sortOrder: 0,
    },
    {
      code: 'basic',
      name: 'Basic',
      description: 'For small tuition centres',
      priceMonthly: 499,
      priceYearly: 4990,
      limits: { users: 5, modules: 15, records: 2000, workflows: 5, forms: 20, batches: 15 },
      features: ['core_crm', 'forms', 'export', 'parent_portal'],
      sortOrder: 1,
    },
    {
      code: 'standard',
      name: 'Standard',
      description: 'Growing teams and multi-batch centres',
      priceMonthly: 999,
      priceYearly: 9990,
      limits: { users: 15, modules: 40, records: 10000, workflows: 25, forms: 50, batches: 40 },
      features: ['core_crm', 'forms', 'export', 'workflows', 'branding', 'parent_portal', 'whatsapp'],
      sortOrder: 2,
    },
    {
      code: 'premium',
      name: 'Premium',
      description: 'Full platform limits for larger institutes',
      priceMonthly: 1999,
      priceYearly: 19990,
      limits: { users: 100, modules: 200, records: 100000, workflows: 200, forms: 200, batches: 200 },
      features: ['core_crm', 'forms', 'export', 'workflows', 'branding', 'priority_support', 'parent_portal', 'whatsapp'],
      sortOrder: 3,
    },
  ];

  for (const plan of defaults) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  try {
    const coupon = {
      code: 'WELCOME20',
      description: '20% off first paid plan',
      discountPercent: 20,
      maxRedemptions: 1000,
      isActive: true,
    };
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: coupon,
      create: coupon,
    });
  } catch (err) {
    console.warn('[plans] coupon seed skipped', err.message);
  }
}

async function uniqueSlug(base) {
  const root = slugify(base);
  let slug = root;
  let i = 0;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${root}-${i}`;
  }
  return slug;
}

/**
 * Create a tenant + owner membership + trial subscription + default modules for a user.
 * `user` is a Prisma User row (uses `id`; `_id` accepted for legacy callers).
 * The passed object is updated in place with activeTenantId / instituteName.
 */
async function createTenantForOwner({
  user,
  name,
  businessCategory = 'tuition',
  settings = {},
}) {
  const userId = user.id || user._id;
  if (!userId) throw new Error('createTenantForOwner: user.id is required');

  await ensurePlans();
  const trialPlan = await prisma.plan.findUnique({ where: { code: 'trial' } });
  if (!trialPlan) throw new Error('Trial plan not found');

  const slug = await uniqueSlug(name || user.name || 'workspace');
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const tenantName = name || `${user.name}'s Workspace`;

  const { tenant, membership } = await prisma.$transaction(async (tx) => {
    const createdTenant = await tx.tenant.create({
      data: {
        name: tenantName,
        slug,
        businessCategory,
        settings: {
          timeZone: settings.timeZone || user.timeZone || 'Asia/Kolkata',
          language: settings.language || user.language || 'en-US',
          currencyLocale: settings.currencyLocale || user.currencyLocale || 'India',
        },
        trialEndsAt,
      },
    });

    const createdMembership = await tx.membership.create({
      data: {
        tenantId: createdTenant.id,
        userId,
        role: 'owner',
        status: 'active',
      },
    });

    await tx.subscription.create({
      data: {
        tenantId: createdTenant.id,
        planId: trialPlan.id,
        status: 'trialing',
        billingCycle: 'monthly',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(trialEndsAt),
      },
    });

    await tx.module.create({
      data: {
        tenantId: createdTenant.id,
        userId,
        name: 'Tuition',
        order: 0,
        isSystem: true,
        sections: DEFAULT_NAV_SECTIONS,
      },
    });

    await tx.customModule.createMany({
      data: SYSTEM_CUSTOM_MODULES.map((m) => ({
        ...m,
        tenantId: createdTenant.id,
        isSystem: true,
        description: `System ${m.name} module`,
      })),
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        activeTenantId: createdTenant.id,
        instituteName: user.instituteName || createdTenant.name,
      },
    });

    return { tenant: createdTenant, membership: createdMembership };
  });

  user.activeTenantId = tenant.id;
  user.instituteName = user.instituteName || tenant.name;

  return { tenant, membership };
}

module.exports = {
  ensurePlans,
  createTenantForOwner,
  DEFAULT_NAV_SECTIONS,
  HIDDEN_NAV_PATHS,
  SYSTEM_CUSTOM_MODULES,
};
