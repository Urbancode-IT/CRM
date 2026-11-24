const express = require('express');
const {
  listForms,
  listTemplates,
  getForm,
  createForm,
  createFromTemplate,
  saveAsTemplate,
  updateForm,
  duplicateForm,
  deleteForm,
  submitForm,
} = require('../controllers/formController');
const { protect, requireTenant, requireRole, requireActiveSubscription } = require('../middleware/auth');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription);

router.get('/templates', listTemplates);
router.post('/from-template', requireRole('owner', 'admin'), createFromTemplate);
router.get('/', listForms);
router.post('/', requireRole('owner', 'admin'), createForm);
router.post('/:id/save-as-template', requireRole('owner', 'admin'), saveAsTemplate);
router.get('/:id', getForm);
router.patch('/:id', requireRole('owner', 'admin'), updateForm);
router.post('/:id/duplicate', requireRole('owner', 'admin'), duplicateForm);
router.delete('/:id', requireRole('owner', 'admin'), deleteForm);
router.post('/:id/submit', submitForm);

module.exports = router;
