const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

router.post('/sepay', webhookController.handleSepayWebhook);

module.exports = router;
