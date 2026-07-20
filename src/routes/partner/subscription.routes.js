const express = require('express');
const sepayController = require('../../controllers/sepay.controller');
const partnerSubscriptionController = require('../../controllers/partner/partnerSubscription.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { transactionIdValidation } = require('../../validations/partnerSubscription.validation');
const { PARTNER } = require('../../constants/roles');

const router = express.Router();

// Public polling endpoint used during Partner registration, before login exists.
router.get('/status/:transactionId', sepayController.getTransactionStatus);

router.use(authenticate, restrictTo(PARTNER));

router.get('/', partnerSubscriptionController.getOverview);
router.post('/renew', partnerSubscriptionController.createRenewal);
router.get(
    '/renew/:transactionId/status',
    transactionIdValidation,
    validate,
    partnerSubscriptionController.getRenewalStatus
);
router.post(
    '/renew/:transactionId/cancel',
    transactionIdValidation,
    validate,
    partnerSubscriptionController.cancelRenewal
);

module.exports = router;
