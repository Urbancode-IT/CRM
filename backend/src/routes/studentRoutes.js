const express = require('express');
const {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');
const { protect, requireTenant, requireRole, requireActiveSubscription } = require('../middleware/auth');
const { attachInstructorScope } = require('../middleware/instructorScope');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription, attachInstructorScope);

router.route('/').get(getStudents).post(createStudent);
router
  .route('/:id')
  .get(getStudent)
  .put(updateStudent)
  .delete(requireRole('owner', 'admin'), deleteStudent);

module.exports = router;
