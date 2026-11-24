const express = require('express');
const {
  listTenants,
  updateTenantStatus,
  platformStats,
  listAuditLogs,
} = require('../controllers/adminController');
const { protect, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(protect, requireSuperAdmin);

router.get('/stats', platformStats);
router.get('/tenants', listTenants);
router.patch('/tenants/:id', updateTenantStatus);
router.get('/audit-logs', listAuditLogs);

module.exports = router;
