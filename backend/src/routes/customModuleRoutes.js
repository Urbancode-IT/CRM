const express = require('express');
const ctrl = require('../controllers/customModuleController');
const { protect, requireTenant, requireRole, requireActiveSubscription } = require('../middleware/auth');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription);

router.get('/', ctrl.listModules);
router.get('/catalog', ctrl.listCatalog);
router.post('/catalog/:catalogId/install', requireRole('owner', 'admin'), ctrl.installCatalogModule);
router.post('/', requireRole('owner', 'admin'), ctrl.createModule);
router.patch('/:id', requireRole('owner', 'admin'), ctrl.updateModule);
router.delete('/:id', requireRole('owner', 'admin'), ctrl.deleteModule);

router.get('/:id/fields', ctrl.listFields);
router.post('/:id/fields', requireRole('owner', 'admin'), ctrl.createField);
router.patch('/:id/fields/:fieldId', requireRole('owner', 'admin'), ctrl.updateField);
router.delete('/:id/fields/:fieldId', requireRole('owner', 'admin'), ctrl.deleteField);
router.put('/:id/fields/reorder', requireRole('owner', 'admin'), ctrl.reorderFields);

router.get('/:id/records', ctrl.listRecords);
router.get('/:id/records/export', ctrl.exportRecords);
router.post('/:id/records', ctrl.createRecord);
router.post(
  '/:id/records/:recordId/convert-student',
  requireRole('owner', 'admin', 'staff'),
  ctrl.convertRecordToStudent
);
router.get('/:id/records/:recordId', ctrl.getRecord);
router.patch('/:id/records/:recordId', ctrl.updateRecord);
router.delete('/:id/records/:recordId', ctrl.deleteRecord);

module.exports = router;
