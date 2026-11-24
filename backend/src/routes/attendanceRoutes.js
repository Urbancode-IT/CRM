const express = require('express');
const {
  getAttendance,
  markAttendance,
  markBulkAttendance,
  deleteAttendance,
  getMonthlyReport,
} = require('../controllers/attendanceController');
const { protect, requireTenant, requireActiveSubscription } = require('../middleware/auth');
const { attachInstructorScope } = require('../middleware/instructorScope');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription, attachInstructorScope);

router.get('/report/monthly', getMonthlyReport);
router.get('/', getAttendance);
router.post('/mark', markAttendance);
router.post('/mark-bulk', markBulkAttendance);
router.delete('/:id', deleteAttendance);

module.exports = router;
