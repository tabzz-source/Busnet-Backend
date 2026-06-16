const { OAuth2Client } = require('google-auth-library');
const AppError = require('../utils/AppError');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify Google ID Token
 * @param {string} idToken - The Google ID Token (credential) sent from frontend
 * @returns {Promise<object>} The verified token payload containing sub, email, name, picture, etc.
 */
const verifyGoogleToken = async (idToken) => {
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        return ticket.getPayload();
    } catch (error) {
        throw new AppError('Invalid Google credential or ID Token: ' + error.message, 401);
    }
};

module.exports = {
    verifyGoogleToken,
};
