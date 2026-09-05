const BookingsService = require('./bookings.service');
const { sendSuccess, sendError } = require('../../utils/response');

class BookingsController {
    static async createBooking(req, res) {
        try {
            const booking = await BookingsService.createBooking(req.user.id, req.body);
            return sendSuccess(res, booking, 'Booking created successfully. Waiting for owner confirmation.', 201);
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
    
    static async getBookings(req, res) {
        try {
            const filters = req.query;
            const bookings = await BookingsService.getBookings(
                req.user.id,
                req.user.role,
                filters
            );
            return sendSuccess(res, bookings);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
    
    static async getBookingById(req, res) {
        try {
            const { id } = req.params;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                return sendError(res, 'Invalid booking ID format', 400);
            }
            const booking = await BookingsService.getBookingById(id, req.user.id, req.user.role);
            return sendSuccess(res, booking);
        } catch (error) {
            return sendError(res, error.message, 404);
        }
    }
    
    static async cancelBooking(req, res) {
        try {
            const { id } = req.params;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                return sendError(res, 'Invalid booking ID format', 400);
            }
            const booking = await BookingsService.cancelBooking(id, req.user.id);
            return sendSuccess(res, booking, 'Booking cancelled successfully');
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
    
    static async getPendingBookings(req, res) {
        try {
            const bookings = await BookingsService.getPendingBookings();
            return sendSuccess(res, bookings);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
    
    static async updateBookingStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            
            if (!status) {
                return sendError(res, 'Status is required', 400);
            }
            
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                return sendError(res, 'Invalid booking ID format', 400);
            }
            
            const booking = await BookingsService.updateBookingStatus(id, status);
            const message = status === 'confirmed' 
                ? 'Booking confirmed! Payment marked as paid. Player added to session.' 
                : `Booking ${status}`;
            return sendSuccess(res, booking, message);
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
}

module.exports = BookingsController;