// One-off script to create the initial admin/tutor login. Run with: npm run seed
require('dotenv').config();
const connectDB = require('./config/db');
const User = require('./models/User');

async function seed() {
  await connectDB();

  const email = (process.env.ADMIN_EMAIL || 'admin@tuition.local').toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    console.log(`[seed] admin user already exists: ${email}`);
  } else {
    await User.create({
      name: process.env.ADMIN_NAME || 'Tutor Manager',
      email,
      password: process.env.ADMIN_PASSWORD || 'change_this_password',
      role: 'admin',
    });
    console.log(`[seed] created admin user: ${email}`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
