const express = require('express');
const { getPublicForm, submitPublicForm } = require('../controllers/formController');

const router = express.Router();

router.get('/:token', getPublicForm);
router.post('/:token/submit', submitPublicForm);

module.exports = router;
