/**
 * Generate a random 6-digit verification code
 * @returns {string} 6-digit code as string (e.g. "482731")
 */
const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = generateVerificationCode;
