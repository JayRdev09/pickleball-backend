const PlayersService = require('./players.service');
const { sendSuccess, sendError } = require('../../utils/response');

class PlayersController {
    static async getMyProfile(req, res) {
        try {
            const profile = await PlayersService.getProfile(req.user.id);
            return sendSuccess(res, profile);
        } catch (error) {
            return sendError(res, error.message, 404);
        }
    }
    
    static async updateMyProfile(req, res) {
        try {
            const { full_name, phone, avatar_url, address, emergency_contact } = req.body;
            const updates = { full_name, phone, avatar_url, address, emergency_contact };
            Object.keys(updates).forEach(key => {
                if (updates[key] === undefined) delete updates[key];
            });
            const profile = await PlayersService.updateProfile(req.user.id, updates);
            return sendSuccess(res, profile, 'Profile updated successfully');
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
    
    static async getSkills(req, res) {
        try {
            const profile = await PlayersService.getProfile(req.user.id);
            return sendSuccess(res, profile.skills);
        } catch (error) {
            return sendError(res, error.message, 404);
        }
    }
    
    static async updateSkills(req, res) {
        try {
            const { skill_tier, serve_rating, return_rating, dink_rating, volley_rating, mobility_rating } = req.body;
            const validTiers = ['beginner', 'intermediate', 'advanced', 'professional'];
            if (!skill_tier || !validTiers.includes(skill_tier)) {
                return sendError(res, 'Invalid skill tier. Must be: beginner, intermediate, advanced, professional', 400);
            }
            const ratings = {};
            if (serve_rating !== undefined) {
                const parsed = parseInt(serve_rating);
                if (parsed >= 1 && parsed <= 10) ratings.serve_rating = parsed;
                else return sendError(res, 'serve_rating must be between 1 and 10', 400);
            }
            if (return_rating !== undefined) {
                const parsed = parseInt(return_rating);
                if (parsed >= 1 && parsed <= 10) ratings.return_rating = parsed;
                else return sendError(res, 'return_rating must be between 1 and 10', 400);
            }
            if (dink_rating !== undefined) {
                const parsed = parseInt(dink_rating);
                if (parsed >= 1 && parsed <= 10) ratings.dink_rating = parsed;
                else return sendError(res, 'dink_rating must be between 1 and 10', 400);
            }
            if (volley_rating !== undefined) {
                const parsed = parseInt(volley_rating);
                if (parsed >= 1 && parsed <= 10) ratings.volley_rating = parsed;
                else return sendError(res, 'volley_rating must be between 1 and 10', 400);
            }
            if (mobility_rating !== undefined) {
                const parsed = parseInt(mobility_rating);
                if (parsed >= 1 && parsed <= 10) ratings.mobility_rating = parsed;
                else return sendError(res, 'mobility_rating must be between 1 and 10', 400);
            }
            const skills = await PlayersService.updateSkills(req.user.id, skill_tier, ratings);
            return sendSuccess(res, skills, 'Skills updated successfully');
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
    
    static async getStats(req, res) {
        try {
            const stats = await PlayersService.getStats(req.user.id);
            return sendSuccess(res, stats);
        } catch (error) {
            return sendError(res, error.message, 404);
        }
    }
    
    static async getAllPlayers(req, res) {
        try {
            const players = await PlayersService.getAllPlayers();
            return sendSuccess(res, players);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
    
    static async getPlayerById(req, res) {
        try {
            const { id } = req.params;
            const player = await PlayersService.getPlayerById(id);
            return sendSuccess(res, player);
        } catch (error) {
            return sendError(res, error.message, 404);
        }
    }
}

module.exports = PlayersController;