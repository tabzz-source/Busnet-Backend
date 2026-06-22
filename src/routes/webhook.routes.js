const express = require('express');
const webhookController = require('../controllers/webhook.controller');
const verifySepayWebhook = require('../middlewares/verifySepayWebhook.middleware');

const router = express.Router();

router.post('/sepay', verifySepayWebhook, webhookController.handleSepayWebhook);

module.exports = router;