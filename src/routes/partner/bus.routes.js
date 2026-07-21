// src/routes/partner/bus.routes.js
const express = require('express');
const busController = require('../../controllers/partner/partnerBus.controller');
const busValidator = require('../../validations/bus.validation');
const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');
const router = express.Router();

router.get('/', auth.authenticate, role.restrictTo('PARTNER'), busController.getMyBuses)

router.get('/:busId', auth.authenticate, role.restrictTo('PARTNER'), busController.getBusDetails)
router.get('/:busId/layout', auth.authenticate, role.restrictTo('PARTNER'), busController.getSeatLayout)
router.post('/', auth.authenticate, role.restrictTo('PARTNER'), busValidator.validateBusCreated, busController.createBus)
router.put('/:busId', auth.authenticate, role.restrictTo('PARTNER'), busValidator.validateBusUpdated, busController.updateBus)
router.patch('/:busId', auth.authenticate, role.restrictTo('PARTNER'), busController.deleteBus)
router.post('/:busId/configure-layout', auth.authenticate, role.restrictTo('PARTNER'), busController.configureSeatLayout)

module.exports = router;