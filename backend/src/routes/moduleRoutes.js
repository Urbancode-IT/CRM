const express = require('express');
const {
  listModules,
  createModule,
  updateModule,
  deleteModule,
  addSection,
  updateSection,
  deleteSection,
} = require('../controllers/moduleController');
const { protect, requireTenant, requireActiveSubscription } = require('../middleware/auth');

const router = express.Router();
router.use(protect, requireTenant, requireActiveSubscription);

router.get('/', listModules);
router.post('/', createModule);
router.patch('/:id', updateModule);
router.delete('/:id', deleteModule);
router.post('/:id/sections', addSection);
router.patch('/:id/sections/:sectionId', updateSection);
router.delete('/:id/sections/:sectionId', deleteSection);

module.exports = router;
