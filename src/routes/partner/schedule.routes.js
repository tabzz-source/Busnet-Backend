const express = require('express');
const scheduleController = require('../../controllers/partner/partnerSchedule.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { PARTNER } = require('../../constants/roles');
const { createScheduleValidation } = require('../../validations/schedule.validation');

const router = express.Router();

router.get('/routes', authenticate, restrictTo(PARTNER), scheduleController.getRoutes);
router.get('/buses', authenticate, restrictTo(PARTNER), scheduleController.getBuses);
router.get('/', authenticate, restrictTo(PARTNER), scheduleController.getSchedules);
router.post('/', authenticate, restrictTo(PARTNER), createScheduleValidation, validate, scheduleController.createSchedule);

module.exports = router;
