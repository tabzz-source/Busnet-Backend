const express = require('express');
const customerSubscriptionController = require('../../controllers/customer/customerSubscription.controller');

const router = express.Router();

router.get('/plans', customerSubscriptionController.getSubscriptionPlans);

module.exports = router;
