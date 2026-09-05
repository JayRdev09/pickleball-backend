const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { sendError } = require('../utils/response');
const config = require('../config/env');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendError(res, 'No token provided', 401);
        }
        
        const token = authHeader.split(' ')[1];
        
        let userId = null;
        let userEmail = null;
        let userRole = null;
        
        try {
            const decoded = jwt.verify(token, config.jwt.secret);
            userId = decoded.id;
            userEmail = decoded.email;
            userRole = decoded.role;
        } catch (jwtError) {
            try {
                const { data: { user }, error: supabaseError } = await supabase.auth.getUser(token);
                if (supabaseError || !user) {
                    return sendError(res, 'Invalid or expired token', 401);
                }
                userId = user.id;
                userEmail = user.email;
            } catch (supabaseError) {
                return sendError(res, 'Invalid or expired token', 401);
            }
        }
        
        let profile = null;
        try {
            const { data, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (profileError) {
                const newProfile = {
                    id: userId,
                    email: userEmail,
                    full_name: userEmail?.split('@')[0] || 'User',
                    username: userEmail?.split('@')[0] || `user_${userId.substring(0, 8)}`,
                    role: userRole || 'player',
                    is_active: true,
                };
                
                const { data: createdProfile, error: createError } = await supabase
                    .from('profiles')
                    .insert(newProfile)
                    .select()
                    .single();
                
                if (createError) {
                    req.user = {
                        id: userId,
                        email: userEmail,
                        role: userRole || 'player',
                        full_name: userEmail?.split('@')[0] || 'User',
                    };
                    return next();
                }
                profile = createdProfile;
            } else {
                profile = data;
            }
        } catch (error) {
            req.user = {
                id: userId,
                email: userEmail,
                role: userRole || 'player',
                full_name: userEmail?.split('@')[0] || 'User',
            };
            return next();
        }
        
        req.user = {
            id: userId,
            email: userEmail,
            ...profile,
        };
        next();
    } catch (error) {
        return sendError(res, 'Authentication failed', 401);
    }
};

module.exports = authMiddleware;