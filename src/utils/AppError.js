/**
 * Custom Application Error with HTTP status code.
 * Thrown in services, caught by error middleware to return correct HTTP status.
 *
 * Usage:
 *   throw new AppError('Email already exists', 409);
 *   throw new AppError('Account not found', 404);
 */
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
