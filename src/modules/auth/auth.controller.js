const AuthService = require('./auth.service');
const { sendSuccess, sendError } = require('../../utils/response');

class AuthController {
    static async register(req, res) {
        try {
            const { email, password, fullName, username, role, phone } = req.body;
            
            if (!email || !password || !fullName || !username) {
                return sendError(res, 'Email, password, full name, and username are required', 400);
            }
            
            if (password.length < 6) {
                return sendError(res, 'Password must be at least 6 characters', 400);
            }
            
            if (username.length < 3) {
                return sendError(res, 'Username must be at least 3 characters', 400);
            }
            
            const profile = await AuthService.register(email, password, fullName, username, role, phone);
            return sendSuccess(res, profile, 'Registration successful', 201);
        } catch (error) {
            return sendError(res, error.message, 400);
        }
    }
    
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            
            if (!email || !password) {
                return sendError(res, 'Email and password are required', 400);
            }
            
            const result = await AuthService.login(email, password);
            return sendSuccess(res, result, 'Login successful');
        } catch (error) {
            return sendError(res, error.message, 401);
        }
    }
    
    static async me(req, res) {
        try {
            const profile = await AuthService.getProfile(req.user.id);
            return sendSuccess(res, {
                ...req.user,
                ...profile,
            });
        } catch (error) {
            return sendError(res, error.message, 404);
        }
    }
    
    static async logout(req, res) {
        try {
            const result = await AuthService.logout();
            return sendSuccess(res, null, result.message);
        } catch (error) {
            return sendError(res, error.message, 500);
        }
    }
}

module.exports = AuthController;