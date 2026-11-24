const express = require('express');
const { getStudentAnalysis } = require('../controllers/analysisController');
const { protect, requireTenant, requireActiveSubscription } = require('../middleware/auth');

const router = express.Router();
router.get('/:id', protect, requireTenant, requireActiveSubscription, getStudentAnalysis);

module.exports = router;
