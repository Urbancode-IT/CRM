const express = require('express');
const {
  getTasks,
  createTask,
  createBatchTasks,
  updateTask,
  deleteTask,
} = require('../controllers/taskController');
const { protect, requireTenant, requireActiveSubscription } = require('../middleware/auth');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription);

router.route('/').get(getTasks).post(createTask);
router.post('/batch', createBatchTasks);
router.route('/:id').put(updateTask).delete(deleteTask);

module.exports = router;
