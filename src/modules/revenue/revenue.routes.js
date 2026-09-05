const express = require('express');
const router = express.Router();
const RevenueController = require('./revenue.controller');
const authMiddleware = require('../../middleware/auth');
const { ownerOnly } = require('../../middleware/roleGuard');

router.use(authMiddleware);
router.use(ownerOnly);

router.get('/summary', RevenueController.getSummary);
router.get('/daily', RevenueController.getDaily);
router.get('/weekly', RevenueController.getWeekly);
router.get('/monthly', RevenueController.getMonthly);
router.get('/sessions', RevenueController.getSessionRevenue);
router.get('/top-players', RevenueController.getTopPlayers);
router.get('/export', RevenueController.exportCSV);

module.exports = router;