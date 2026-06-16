// src/routes/partner/auth.routes.js

const express = require('express');
const partnerAuthController = require('../../controllers/partner/partnerAuth.controller');

const router = express.Router();

router.post('/login', partnerAuthController.login);

module.exports = router;
