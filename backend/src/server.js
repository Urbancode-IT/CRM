require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { startScheduler } = require('./jobs/scheduler');
const { migrateExistingDataToTenants } = require('./services/migrateTenants');
const { ensurePlans } = require('./services/tenantBootstrap');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  await ensurePlans();
  await migrateExistingDataToTenants();

  if (process.env.VERCEL) {
    console.log('[server] running on Vercel — scheduler disabled (use Vercel Cron)');
    return;
  }

  startScheduler();
  app.listen(PORT, () => console.log(`[server] User API listening on port ${PORT}`));
}

start().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
