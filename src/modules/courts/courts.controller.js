const CourtsService = require('./courts.service');
const { sendSuccess, sendError } = require('../../utils/response');

class CourtsController {
    static async getAllCourts(req, res) {
        try {
            const courts = await CourtsService.getAllCourts();
            return sendSuccess(res, courts);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
    
    static async getCourtById(req, res) {
        try {
            const { id } = req.params;
            const court = await CourtsService.getCourtById(id);
            return sendSuccess(res, court);
        } catch (error) {
            return sendError(res, error.message, 404);
        }
    }
    
    static async createCourt(req, res) {
        try {
            const court = await CourtsService.createCourt(req.body);
            return sendSuccess(res, court, 'Court created successfully', 201);
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
    
    static async updateCourt(req, res) {
        try {
            const { id } = req.params;
            const court = await CourtsService.updateCourt(id, req.body);
            return sendSuccess(res, court, 'Court updated successfully');
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
    
    static async deleteCourt(req, res) {
        try {
            const { id } = req.params;
            const result = await CourtsService.deleteCourt(id);
            return sendSuccess(res, result, 'Court deleted successfully');
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
}

module.exports = CourtsController;