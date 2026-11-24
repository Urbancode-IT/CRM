const express = require('express');
const {
  listInstructors,
  getInstructor,
  createInstructor,
  updateInstructor,
  deleteInstructor,
  getInstructorAttendance,
  markInstructorAttendanceBulk,
} = require('../controllers/instructorController');
const { protect, requireTenant, requireActiveSubscription, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription);

router.get('/attendance', getInstructorAttendance);
router.post('/attendance/mark-bulk', requireRole('owner', 'admin', 'staff'), markInstructorAttendanceBulk);

router.get('/', listInstructors);
router.post('/', requireRole('owner', 'admin'), createInstructor);
router.get('/:id', getInstructor);
router.put('/:id', requireRole('owner', 'admin'), updateInstructor);
router.delete('/:id', requireRole('owner', 'admin'), deleteInstructor);

module.exports = router;
