const express = require('express');
const router = express.Router();
const BookingsController = require('./bookings.controller');
const authMiddleware = require('../../middleware/auth');
const { ownerOnly } = require('../../middleware/roleGuard');

router.get('/pending', authMiddleware, ownerOnly, BookingsController.getPendingBookings);
router.post('/', authMiddleware, BookingsController.createBooking);
router.get('/', authMiddleware, BookingsController.getBookings);
router.get('/:id', authMiddleware, BookingsController.getBookingById);
router.delete('/:id', authMiddleware, BookingsController.cancelBooking);
router.put('/:id/status', authMiddleware, ownerOnly, BookingsController.updateBookingStatus);

module.exports = router;