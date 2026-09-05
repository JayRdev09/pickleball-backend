const express = require('express');
const router = express.Router();
const SessionsController = require('./sessions.controller');
const authMiddleware = require('../../middleware/auth');
const { ownerOnly } = require('../../middleware/roleGuard');

router.get('/', SessionsController.getSessions);
router.get('/cleanup', authMiddleware, ownerOnly, SessionsController.cleanupExpired);
router.get('/:id', SessionsController.getSessionById);
router.post('/', authMiddleware, ownerOnly, SessionsController.createSession);
router.post('/:id/players', authMiddleware, ownerOnly, SessionsController.addPlayerToSession);
router.delete('/:id/players/:playerId', authMiddleware, ownerOnly, SessionsController.removePlayerFromSession);
router.delete('/:id', authMiddleware, ownerOnly, SessionsController.deleteSession);
router.post('/:id/start', authMiddleware, ownerOnly, SessionsController.startSession);
router.post('/:id/end', authMiddleware, ownerOnly, SessionsController.endSession);

module.exports = router;