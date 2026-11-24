const express = require('express');
const {
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
} = require('../controllers/workflowController');
const { protect, requireTenant, requireRole, requireActiveSubscription } = require('../middleware/auth');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription);

router.get('/', listWorkflows);
router.post('/', requireRole('owner', 'admin'), createWorkflow);
router.patch('/:id', requireRole('owner', 'admin'), updateWorkflow);
router.delete('/:id', requireRole('owner', 'admin'), deleteWorkflow);

module.exports = router;
