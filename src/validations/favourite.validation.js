const { param } = require('express-validator');

const validatePartnerId = [
    param('partnerId')
        .notEmpty()
        .withMessage('Partner ID is required')
        .isMongoId()
        .withMessage('Invalid partner ID')
];

module.exports = {
    validatePartnerId
};