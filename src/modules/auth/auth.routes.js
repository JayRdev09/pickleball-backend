const express = require('express');
const router = express.Router();
const AuthController = require('./auth.controller');
const authMiddleware = require('../../middleware/auth');

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// Protected routes
router.get('/me', authMiddleware, AuthController.me);
router.post('/logout', authMiddleware, AuthController.logout);

module.exports = router;