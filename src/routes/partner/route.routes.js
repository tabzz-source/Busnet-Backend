// src/routes/partner/route.routes.js
const express = require('express');
const routeController = require('../../controllers/partner/partnerRoute.controller');
const routeValidator = require('../../validations/route.validation');
const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');
const router = express.Router();

router.get('/', auth.authenticate, role.restrictTo('PARTNER'), routeController.getMyRoutes)
router.get('/:routeId', auth.authenticate, role.restrictTo('PARTNER'), routeController.getRouteDetails)
router.post('/', auth.authenticate, role.restrictTo('PARTNER'), routeValidator.validateRouteCreated, routeController.createRoute)
router.put('/:routeId', auth.authenticate, role.restrictTo('PARTNER'), routeValidator.validateRouteUpdated, routeController.updateRoutes)
router.patch('/:routeId/status', auth.authenticate, role.restrictTo('PARTNER'), routeController.toggleRouteStatus)

module.exports = router;