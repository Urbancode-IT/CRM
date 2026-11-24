const express = require('express');
const {
  listTrash,
  restoreItem,
  permanentDelete,
  emptyTrash,
} = require('../controllers/recycleBinController');
const { protect, requireTenant, requireActiveSubscription, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription);

router.get('/', listTrash);
router.post('/empty', requireRole('owner', 'admin'), emptyTrash);
router.post('/:id/restore', restoreItem);
router.delete('/:id', requireRole('owner', 'admin'), permanentDelete);

module.exports = router;
