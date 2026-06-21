// src/routes/customer/feedback.routes.js
const express = require('express');
const feedbackController = require('../../controllers/customer/customerFeedback.controller');
const authenticate = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
    validateCreateFeedback,
    validateTripId,
    validatePartnerId
} = require('../../validations/feedback.validation');

const router = express.Router();

router.get(
    '/trips/:tripId',
    validateTripId,
    validate,
    feedbackController.getFeedbacksByTrip
);

router.get(
    '/operators/:partnerId',
    validatePartnerId,
    validate,
    feedbackController.getFeedbacksByPartner
);

router.use(authenticate);

router.use((req, res, next) => {
    if (req.user.role !== 'CUSTOMER') {
        return res.status(403).json({
            success: false,
            message: 'Customer access only'
        });
    }

    next();
});

router.post(
    '/',
    validateCreateFeedback,
    validate,
    feedbackController.createFeedback
);

router.get(
    '/me',
    feedbackController.getMyFeedbacks
);

module.exports = router;