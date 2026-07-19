const express = require('express');
const sepayController = require('../../controllers/sepay.controller');
const subscriptionController = require('../../controllers/partner/partnerSubscription.controller')
const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');
const router = express.Router();

// GET /api/partner/subscription/status/:transactionId
router.get('/status/:transactionId', sepayController.getTransactionStatus);
router.get('/', auth.authenticate, role.restrictTo('PARTNER'), subscriptionController.getMySubscriptions)

module.exports = router;
