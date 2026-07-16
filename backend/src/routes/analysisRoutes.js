const express = require('express');
const { getStudentAnalysis } = require('../controllers/analysisController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.get('/:id', protect, getStudentAnalysis);

module.exports = router;
