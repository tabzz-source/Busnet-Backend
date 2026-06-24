const express = require('express');
const scheduleController = require('../../controllers/partner/partnerSchedule.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { PARTNER } = require('../../constants/roles');
const { createScheduleValidation, updateScheduleValidation } = require('../../validations/schedule.validation');

const router = express.Router();

router.get('/routes', authenticate, restrictTo(PARTNER), scheduleController.getRoutes);
router.get('/buses', authenticate, restrictTo(PARTNER), scheduleController.getBuses);
router.get('/', authenticate, restrictTo(PARTNER), scheduleController.getSchedules);
router.get('/:id', authenticate, restrictTo(PARTNER), scheduleController.getScheduleDetail);
router.post('/', authenticate, restrictTo(PARTNER), createScheduleValidation, validate, scheduleController.createSchedule);
router.put('/:id', authenticate, restrictTo(PARTNER), updateScheduleValidation, validate, scheduleController.updateSchedule);
router.delete('/:id', authenticate, restrictTo(PARTNER), scheduleController.deleteSchedule);

module.exports = router;
