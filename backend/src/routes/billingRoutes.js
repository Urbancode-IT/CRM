const express = require('express');
const {
  getPaymentProviders,
  listPlans,
  getSubscription,
  createCheckout,
  confirmPayment,
  cancelSubscription,
  validateCoupon,
} = require('../controllers/billingController');
const { protect, requireTenant, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/providers', protect, getPaymentProviders);
router.get('/plans', protect, listPlans);
router.get('/subscription', protect, requireTenant, getSubscription);
router.post('/coupon', protect, requireTenant, requireRole('owner', 'admin'), validateCoupon);
router.post('/checkout', protect, requireTenant, requireRole('owner', 'admin'), createCheckout);
router.post('/confirm', protect, requireTenant, requireRole('owner', 'admin'), confirmPayment);
router.post('/cancel', protect, requireTenant, requireRole('owner'), cancelSubscription);

module.exports = router;
