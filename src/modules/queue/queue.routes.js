const express = require('express');
const router = express.Router();
const QueueController = require('./queue.controller');
const authMiddleware = require('../../middleware/auth');
const { ownerOnly } = require('../../middleware/roleGuard');

router.get('/session/:id', authMiddleware, QueueController.getQueue);
router.get('/player/status/:id', authMiddleware, QueueController.getPlayerStatus);
router.get('/current-match/:id', authMiddleware, QueueController.getCurrentMatch);
router.get('/tournament/:id/bracket', authMiddleware, QueueController.getTournamentBracket);
router.post('/session/:id/build', authMiddleware, ownerOnly, QueueController.buildQueue);
router.post('/session/:id/tournament/build', authMiddleware, ownerOnly, QueueController.buildTournamentQueue);
router.post('/session/:id/next', authMiddleware, ownerOnly, QueueController.nextMatch);
router.post('/match/:matchId/complete', authMiddleware, ownerOnly, QueueController.completeMatch);
router.post('/session/:id/insert', authMiddleware, ownerOnly, QueueController.insertPlayer);
router.delete('/session/:id/remove/:entryId', authMiddleware, ownerOnly, QueueController.removePlayer);
router.put('/session/:id/reorder', authMiddleware, ownerOnly, QueueController.reorderQueue);


module.exports = router;