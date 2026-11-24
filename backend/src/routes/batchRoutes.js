const express = require('express');
const {
  listBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  getTimetable,
} = require('../controllers/batchController');
const { protect, requireTenant, requireRole, requireActiveSubscription } = require('../middleware/auth');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription);

router.get('/timetable', getTimetable);
router.get('/', listBatches);
router.post('/', requireRole('owner', 'admin'), createBatch);
router.patch('/:id', requireRole('owner', 'admin'), updateBatch);
router.delete('/:id', requireRole('owner', 'admin'), deleteBatch);

module.exports = router;
