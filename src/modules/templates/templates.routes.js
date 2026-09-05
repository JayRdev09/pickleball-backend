const express = require('express');
const router = express.Router();
const templatesController = require('./templates.controller');

router.get('/', templatesController.getTemplates);
router.post('/', templatesController.createTemplate);
router.delete('/:id', templatesController.deleteTemplate);

module.exports = router;