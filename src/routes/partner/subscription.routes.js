const express = require('express');
const sepayController = require('../../controllers/sepay.controller');

const router = express.Router();

// GET /api/partner/subscription/status/:transactionId
router.get('/status/:transactionId', sepayController.getTransactionStatus);

module.exports = router;
