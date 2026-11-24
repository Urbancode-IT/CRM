require('dotenv').config();
const { connectDB, prisma } = require('../src/config/db');

(async () => {
  await connectDB();
  const result = await prisma.user.updateMany({
    data: { mfaEnabled: false, mfaSecret: '', mfaBackupCodes: [] },
  });
  console.log(`MFA disabled for ${result.count} user(s)`);
  await prisma.$disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
