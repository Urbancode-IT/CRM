require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { startScheduler } = require('./jobs/scheduler');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  // On Vercel, the serverless entry (api/index.js) handles requests and
  // Vercel Cron hits /api/cron/* — do not listen or start node-cron.
  if (process.env.VERCEL) {
    console.log('[server] running on Vercel — scheduler disabled (use Vercel Cron)');
    return;
  }

  startScheduler();
  app.listen(PORT, () => console.log(`[server] Tuition CRM API listening on port ${PORT}`));
}

start().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
