const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};

const sendError = (res, message = 'Error', statusCode = 500, errors = null) => {
    return res.status(statusCode).json({
        success: false,
        message,
        errors,
    });
};

const sendPaginated = (res, data, total, page, limit, message = 'Success') => {
    return res.status(200).json({
        success: true,
        message,
        data,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    });
};

module.exports = {
    sendSuccess,
    sendError,
    sendPaginated,
};