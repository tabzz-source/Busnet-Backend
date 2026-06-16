const crypto = require('crypto');

const generateCode = (length = 6) => {
    return crypto.randomInt(10 ** (length - 1), 10 ** length).toString();
};

module.exports = generateCode;
