const express = require('express');
const router = express.Router();
const PlayersController = require('./players.controller');
const authMiddleware = require('../../middleware/auth');
const { ownerOnly } = require('../../middleware/roleGuard');

router.get('/profile', authMiddleware, PlayersController.getMyProfile);
router.put('/profile', authMiddleware, PlayersController.updateMyProfile);
router.get('/skills', authMiddleware, PlayersController.getSkills);
router.put('/skills', authMiddleware, PlayersController.updateSkills);
router.get('/stats', authMiddleware, PlayersController.getStats);
router.get('/:id', authMiddleware, PlayersController.getPlayerById);
router.get('/', authMiddleware, ownerOnly, PlayersController.getAllPlayers);

module.exports = router;