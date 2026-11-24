require('dotenv').config();
const { connectDB, prisma } = require('./config/db');
const { hashPassword } = require('./utils/password');
const { createTenantForOwner, ensurePlans } = require('./services/tenantBootstrap');

async function seed() {
  await connectDB();
  await ensurePlans();

  const email = (process.env.ADMIN_EMAIL || 'admin@tuition.local').toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: process.env.ADMIN_NAME || 'Workspace Owner',
        email,
        password: await hashPassword(process.env.ADMIN_PASSWORD || 'change_this_password'),
        role: 'admin',
        isSuperAdmin: process.env.ADMIN_IS_SUPER === 'true',
        onboardingCompleted: false,
      },
    });
    console.log(`[seed] created admin user: ${email}`);
  } else {
    if (process.env.ADMIN_IS_SUPER === 'true' && !user.isSuperAdmin) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isSuperAdmin: true },
      });
      console.log(`[seed] granted super admin to ${email}`);
    }
    console.log(`[seed] admin user already exists: ${email}`);
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: 'active' },
  });
  if (!membership) {
    const { tenant } = await createTenantForOwner({
      user,
      name: user.instituteName || process.env.ADMIN_NAME || 'Demo Institute',
      businessCategory: 'tuition',
    });
    console.log(`[seed] created tenant: ${tenant.slug}`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
