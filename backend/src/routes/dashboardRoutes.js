const express = require('express');
const { getDashboard } = require('../controllers/dashboardController');
const { protect, requireTenant, requireActiveSubscription } = require('../middleware/auth');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription);
router.get('/', getDashboard);

module.exports = router;
