const express = require('express');
const {
  getAttendance,
  markAttendance,
  markBulkAttendance,
  deleteAttendance,
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/', getAttendance);
router.post('/mark', markAttendance);
router.post('/mark-bulk', markBulkAttendance);
router.delete('/:id', deleteAttendance);

module.exports = router;
