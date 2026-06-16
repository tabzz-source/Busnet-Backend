const crypto = require('crypto');

const generateCode = (length = 6) => {
    const max = 10 ** length;
    return crypto.randomInt(0, max).toString().padStart(length, '0');
};

module.exports = generateCode;
