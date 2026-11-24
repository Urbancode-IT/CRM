const express = require('express');
const {
  feesReport,
  attendanceReport,
  studentsExport,
  overviewReport,
} = require('../controllers/reportController');
const { protect, requireTenant, requireActiveSubscription } = require('../middleware/auth');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription);

router.get('/overview', overviewReport);
router.get('/fees', feesReport);
router.get('/attendance', attendanceReport);
router.get('/students', studentsExport);

module.exports = router;
