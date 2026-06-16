/**
 * Standardized success response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code (200, 201, etc.)
 * @param {string} message - Success message
 * @param {object} [data] - Response data payload
 */
const successResponse = (res, statusCode, message, data = null) => {
    const response = { success: true, message };
    if (data !== null) response.data = data;
    return res.status(statusCode).json(response);
};

/**
 * Standardized error response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code (400, 404, 409, etc.)
 * @param {string} message - Error message
 * @param {Array} [errors] - Validation error details
 */
const errorResponse = (res, statusCode, message, errors = null) => {
    const response = { success: false, message };
    if (errors !== null) response.errors = errors;
    return res.status(statusCode).json(response);
};

module.exports = { successResponse, errorResponse };
