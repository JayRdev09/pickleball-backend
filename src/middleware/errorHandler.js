const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    if (err.isJoi) {
        return sendError(res, 'Validation error', 400, err.details);
    }
    
    if (err.code && err.code.startsWith('PGRST')) {
        return sendError(res, 'Database error', 400, err.message);
    }
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';
    return sendError(res, message, statusCode);
};

module.exports = errorHandler;