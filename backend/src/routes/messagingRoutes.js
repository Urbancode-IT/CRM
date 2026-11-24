const express = require('express');
const ctrl = require('../controllers/messagingController');
const { protect, requireTenant, requireRole, requireActiveSubscription } = require('../middleware/auth');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription);

router.get('/templates', ctrl.listTemplates);
router.post('/send', requireRole('owner', 'admin', 'staff'), ctrl.sendQuickMessage);

module.exports = router;
