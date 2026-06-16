const jwt = require("jsonwebtoken");

/**
 * Generate JWT token
 * @param {object} payload - Token payload { accountId, role }
 * @returns {string} JWT token string
 */
const generateToken = (payload) => {
    return jwt.sign(
        { id: payload.accountId, role: payload.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
};

module.exports = generateToken;