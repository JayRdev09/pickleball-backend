const SessionsService = require('./sessions.service');
const { sendSuccess, sendError } = require('../../utils/response');

class SessionsController {
    static async createSession(req, res) {
        try {
            const session = await SessionsService.createSession(req.user.id, req.body);
            return sendSuccess(res, session, 'Session created successfully', 201);
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
    
    static async getSessions(req, res) {
        try {
            const filters = req.query;
            const sessions = await SessionsService.getSessions(filters);
            return sendSuccess(res, sessions);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
    
    static async getSessionById(req, res) {
        try {
            const { id } = req.params;
            const session = await SessionsService.getSessionById(id);
            return sendSuccess(res, session);
        } catch (error) {
            return sendError(res, error.message, 404);
        }
    }
    
    static async addPlayerToSession(req, res) {
        try {
            const { id } = req.params;
            const { player_id, booking_id, is_walkin } = req.body;
            if (!player_id) {
                return sendError(res, 'Player ID is required', 400);
            }
            const result = await SessionsService.addPlayerToSession(id, player_id, booking_id, is_walkin);
            return sendSuccess(res, result, 'Player added to session');
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
    
    static async removePlayerFromSession(req, res) {
        try {
            const { id, playerId } = req.params;
            const result = await SessionsService.removePlayerFromSession(id, playerId);
            return sendSuccess(res, result, 'Player removed from session');
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
    
    static async startSession(req, res) {
        try {
            const { id } = req.params;
            const session = await SessionsService.updateSessionStatus(id, 'active');
            return sendSuccess(res, session, 'Session started');
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
    
    static async endSession(req, res) {
        try {
            const { id } = req.params;
            const session = await SessionsService.updateSessionStatus(id, 'completed');
            return sendSuccess(res, session, 'Session ended');
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
    
    static async deleteSession(req, res) {
        try {
            const { id } = req.params;
            const result = await SessionsService.deleteSession(id);
            return sendSuccess(res, result, 'Session deleted');
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
    
    static async cleanupExpired(req, res) {
        try {
            const result = await SessionsService.cleanupExpiredSessions();
            return sendSuccess(res, result, `Cleaned up ${result.deleted} expired sessions`);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
}

module.exports = SessionsController;