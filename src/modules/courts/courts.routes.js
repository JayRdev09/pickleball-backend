const express = require('express');
const router = express.Router();
const CourtsController = require('./courts.controller');
const authMiddleware = require('../../middleware/auth');
const { ownerOnly } = require('../../middleware/roleGuard');

// Public routes (any authenticated user can view courts)
router.get('/', authMiddleware, CourtsController.getAllCourts);
router.get('/:id', authMiddleware, CourtsController.getCourtById);

// Owner-only routes
router.post('/', authMiddleware, ownerOnly, CourtsController.createCourt);
router.put('/:id', authMiddleware, ownerOnly, CourtsController.updateCourt);
router.delete('/:id', authMiddleware, ownerOnly, CourtsController.deleteCourt);

module.exports = router;