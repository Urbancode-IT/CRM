const express = require('express');
const {
  requestAccess,
  verifyAccess,
  parentDashboard,
} = require('../controllers/parentController');

const router = express.Router();

router.post('/request', requestAccess);
router.post('/verify', verifyAccess);
router.get('/dashboard', parentDashboard);

module.exports = router;
