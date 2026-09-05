const RevenueService = require('./revenue.service');
const { sendSuccess, sendError } = require('../../utils/response');

class RevenueController {
    static async getSummary(req, res) {
        try {
            const summary = await RevenueService.getSummary();
            return sendSuccess(res, summary);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
    
    static async getDaily(req, res) {
        try {
            const { date } = req.query;
            const revenue = await RevenueService.getDailyRevenue(date);
            return sendSuccess(res, revenue);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
    
    static async getWeekly(req, res) {
        try {
            const revenue = await RevenueService.getWeeklyRevenue();
            return sendSuccess(res, revenue);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
    
    static async getMonthly(req, res) {
        try {
            const { month, year } = req.query;
            const revenue = await RevenueService.getMonthlyRevenue(
                month ? parseInt(month) : undefined,
                year ? parseInt(year) : undefined
            );
            return sendSuccess(res, revenue);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
    
    static async getSessionRevenue(req, res) {
        try {
            const revenue = await RevenueService.getSessionRevenue();
            return sendSuccess(res, revenue);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
    
    static async getTopPlayers(req, res) {
        try {
            const { limit } = req.query;
            const players = await RevenueService.getTopPlayers(limit ? parseInt(limit) : 10);
            return sendSuccess(res, players);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
    
    static async exportCSV(req, res) {
        try {
            const csv = await RevenueService.exportCSV();
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=revenue-${new Date().toISOString().split('T')[0]}.csv`);
            return res.send(csv);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
}

module.exports = RevenueController;