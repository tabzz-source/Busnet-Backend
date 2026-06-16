const express = require('express');
const router = express.Router();
const operatorController = require('../../controllers/customer/customerOperator.controller');

// GET /api/customer/operators — List all verified operators (public)
router.get('/', operatorController.getOperators);

// GET /api/customer/operators/:id — Get operator detail by accountId (public)
router.get('/:id', operatorController.getOperatorDetail);

module.exports = router;
