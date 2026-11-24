const cron = require('node-cron');
const { runPaymentAutomation } = require('./reminderJob');
const { autoMarkMissingAttendance } = require('./attendanceJob');
const { generateRecurringTasks } = require('./taskJob');
const { cleanupExpiredOtps } = require('./otpCleanupJob');

function startScheduler() {
  const paymentCron = process.env.PAYMENT_REMINDER_CRON || '0 8 * * *';
  const attendanceCron = process.env.ATTENDANCE_AUTOMARK_CRON || '0 20 * * *';
  const taskCron = process.env.TASK_AUTOMATION_CRON || '0 6 * * *';
  const otpCleanupCron = process.env.OTP_CLEANUP_CRON || '0 * * * *';

  cron.schedule(paymentCron, () => {
    runPaymentAutomation().catch((err) => console.error('[scheduler] payment automation failed', err));
  });

  cron.schedule(attendanceCron, () => {
    autoMarkMissingAttendance().catch((err) => console.error('[scheduler] attendance automation failed', err));
  });

  cron.schedule(taskCron, () => {
    generateRecurringTasks().catch((err) => console.error('[scheduler] task automation failed', err));
  });

  cron.schedule(otpCleanupCron, () => {
    cleanupExpiredOtps().catch((err) => console.error('[scheduler] otp cleanup failed', err));
  });

  console.log(
    `[scheduler] jobs scheduled - payments: "${paymentCron}", attendance: "${attendanceCron}", tasks: "${taskCron}", otp: "${otpCleanupCron}"`
  );
}

module.exports = { startScheduler };
