const { sendError } = require('../utils/response');

const roleGuard = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return sendError(res, 'User not authenticated', 401);
        }
        if (!allowedRoles.includes(req.user.role)) {
            return sendError(res, 'Insufficient permissions', 403);
        }
        next();
    };
};

const ownerOnly = roleGuard(['owner']);
const playerOnly = roleGuard(['player', 'owner']);
const anyUser = roleGuard(['player', 'owner']);

module.exports = {
    roleGuard,
    ownerOnly,
    playerOnly,
    anyUser,
};