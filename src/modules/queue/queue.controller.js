const QueueService = require('./queue.service');
const { sendSuccess, sendError } = require('../../utils/response');

class QueueController {
    static async getQueue(req, res) {
        try {
            const { id } = req.params;
            const queue = await QueueService.getQueue(id);
            return sendSuccess(res, queue);
        } catch (error) {
            console.error('Get queue error:', error);
            return sendError(res, error.message, 404);
        }
    }
    
    static async buildQueue(req, res) {
        try {
            const { id } = req.params;
            const queue = await QueueService.buildQueue(id);
            return sendSuccess(res, queue, 'Queue built successfully');
        } catch (error) {
            console.error('Build queue error:', error);
            return sendError(res, error.message, 400);
        }
    }
    
    static async buildTournamentQueue(req, res) {
        try {
            const { id } = req.params;
            const { type, seedMethod } = req.body;
            const tournamentOptions = {
                type: type || 'single_elimination',
                seedMethod: seedMethod || 'skill',
            };
            const queue = await QueueService.buildTournamentQueue(id, tournamentOptions);
            return sendSuccess(res, queue, 'Tournament queue built successfully');
        } catch (error) {
            console.error('Build tournament queue error:', error);
            return sendError(res, error.message, 400);
        }
    }
    
    static async getTournamentBracket(req, res) {
        try {
            const { id } = req.params;
            const bracket = await QueueService.getTournamentBracket(id);
            return sendSuccess(res, bracket);
        } catch (error) {
            console.error('Get tournament bracket error:', error);
            return sendError(res, error.message, 404);
        }
    }
    
    static async nextMatch(req, res) {
        try {
            const { id } = req.params;
            const result = await QueueService.nextMatch(id);
            return sendSuccess(res, result, 'Match started');
        } catch (error) {
            console.error('Next match error:', error);
            return sendError(res, error.message, 400);
        }
    }
    
    // ✅ FIXED: Use the correct method name
    static async completeMatch(req, res) {
        try {
            const { matchId } = req.params;
            const { team1_score, team2_score, winner_team } = req.body;
            
            if (team1_score === undefined || team2_score === undefined || winner_team === undefined) {
                return sendError(res, 'team1_score, team2_score, and winner_team are required', 400);
            }
            
            // ✅ Use completeMatchAndAdvance (the method that exists)
            const result = await QueueService.completeMatchAndAdvance(
                matchId, 
                team1_score, 
                team2_score, 
                winner_team
            );
            
            const message = result.next_match?.match 
                ? 'Match completed! Next match started automatically.' 
                : 'Match completed! No more matches available.';
            
            return sendSuccess(res, result, message);
        } catch (error) {
            console.error('Complete match error:', error);
            return sendError(res, error.message, 400);
        }
    }
    
    static async getCurrentMatch(req, res) {
        try {
            const { id } = req.params;
            const match = await QueueService.getCurrentMatch(id);
            return sendSuccess(res, match);
        } catch (error) {
            console.error('Get current match error:', error);
            return sendError(res, error.message, 404);
        }
    }
    
    static async insertPlayer(req, res) {
        try {
            const { id } = req.params;
            const { player_id, position } = req.body;
            if (!player_id) return sendError(res, 'Player ID is required', 400);
            const entry = await QueueService.insertPlayer(id, player_id, position);
            return sendSuccess(res, entry, 'Player inserted into queue');
        } catch (error) {
            console.error('Insert player error:', error);
            return sendError(res, error.message, 400);
        }
    }
    
    static async removePlayer(req, res) {
        try {
            const { entryId } = req.params;
            const result = await QueueService.removePlayer(entryId);
            return sendSuccess(res, result, 'Player removed from queue');
        } catch (error) {
            console.error('Remove player error:', error);
            return sendError(res, error.message, 400);
        }
    }
    
    static async reorderQueue(req, res) {
        try {
            const { id } = req.params;
            const { order } = req.body;
            if (!order || !Array.isArray(order)) {
                return sendError(res, 'Order array is required', 400);
            }
            const result = await QueueService.reorderQueue(id, order);
            return sendSuccess(res, result, 'Queue reordered');
        } catch (error) {
            console.error('Reorder queue error:', error);
            return sendError(res, error.message, 400);
        }
    }
    
    static async getPlayerStatus(req, res) {
        try {
            const { id } = req.params;
            const status = await QueueService.getPlayerStatus(id, req.user.id);
            return sendSuccess(res, status);
        } catch (error) {
            console.error('Get player status error:', error);
            return sendError(res, error.message, 404);
        }
    }
}

module.exports = QueueController;