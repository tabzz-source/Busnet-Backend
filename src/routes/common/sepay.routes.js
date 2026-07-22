const express = require('express');
const sepayController = require('../../controllers/sepay.controller');
const sepayAuthMiddleware = require('../../middlewares/sepayAuth.middleware');

const router = express.Router();

// POST /api/sepay/webhook
router.post('/webhook', sepayAuthMiddleware, sepayController.handleWebhook);

module.exports = router;
