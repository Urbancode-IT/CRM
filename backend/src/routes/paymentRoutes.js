const express = require('express');
const {
  getPayments,
  createPayment,
  markPaid,
  updatePayment,
  deletePayment,
  getReceipt,
} = require('../controllers/paymentController');
const { protect, requireTenant, requireRole, requireActiveSubscription } = require('../middleware/auth');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription);

router.route('/').get(getPayments).post(createPayment);
router.patch('/:id/mark-paid', markPaid);
router.get('/:id/receipt', getReceipt);
router.route('/:id').put(updatePayment).delete(requireRole('owner', 'admin'), deletePayment);

module.exports = router;
