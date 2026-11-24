require('dotenv').config();
const { connectDB, prisma } = require('./config/db');
const { forceReloadSampleData } = require('./services/demoDataService');
const { migrateExistingDataToTenants } = require('./services/migrateTenants');

async function seedDemoData() {
  await connectDB();
  await migrateExistingDataToTenants();

  const membership = await prisma.membership.findFirst({
    where: { role: 'owner' },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) {
    console.error('[seed:demo] no owner membership found — run npm run seed first');
    await prisma.$disconnect();
    process.exit(1);
  }

  const result = await forceReloadSampleData(membership.tenantId);
  console.log(`[seed:demo] tenant=${membership.tenantId}`);
  console.log(`[seed:demo] created ${result.students} students`);
  console.log(`[seed:demo] created ${result.payments} payment records`);
  console.log(`[seed:demo] created ${result.attendance} attendance records`);
  console.log(`[seed:demo] created ${result.tasks} tasks`);
  console.log('[seed:demo] done');
  await prisma.$disconnect();
  process.exit(0);
}

seedDemoData().catch((err) => {
  console.error('[seed:demo] failed', err);
  process.exit(1);
});
