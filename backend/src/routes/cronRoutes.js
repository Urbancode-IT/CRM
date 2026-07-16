const express = require('express');
const { verifyCron } = require('../middleware/cronAuth');
const { runPaymentAutomation } = require('../jobs/reminderJob');
const { autoMarkMissingAttendance } = require('../jobs/attendanceJob');
const { generateRecurringTasks } = require('../jobs/taskJob');

const router = express.Router();

router.use(verifyCron);

router.get('/payments', async (req, res, next) => {
  try {
    await runPaymentAutomation();
    res.json({ ok: true, job: 'payments' });
  } catch (err) {
    next(err);
  }
});

router.get('/attendance', async (req, res, next) => {
  try {
    const marked = await autoMarkMissingAttendance();
    res.json({ ok: true, job: 'attendance', marked });
  } catch (err) {
    next(err);
  }
});

router.get('/tasks', async (req, res, next) => {
  try {
    const created = await generateRecurringTasks();
    res.json({ ok: true, job: 'tasks', created });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
