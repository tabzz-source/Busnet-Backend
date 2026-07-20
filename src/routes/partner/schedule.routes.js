const express = require('express');
const scheduleController = require('../../controllers/partner/partnerSchedule.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { PARTNER } = require('../../constants/roles');
const { createScheduleValidation, updateScheduleValidation } = require('../../validations/schedule.validation');
const { setTicketPriceValidation } = require('../../validations/ticketPrice.validation');

const router = express.Router();

router.get('/routes', authenticate, restrictTo(PARTNER), scheduleController.getRoutes);
router.get('/buses', authenticate, restrictTo(PARTNER), scheduleController.getBuses);
router.get('/', authenticate, restrictTo(PARTNER), scheduleController.getSchedules);
router.get('/:id/ticket-prices/:ticketPriceId', authenticate, restrictTo(PARTNER), scheduleController.getScheduleTicketPriceDetail);
router.get('/:id/ticket-prices', authenticate, restrictTo(PARTNER), scheduleController.getScheduleTicketPrices);
router.get('/:id', authenticate, restrictTo(PARTNER), scheduleController.getScheduleDetail);
router.post('/:id/ticket-prices', authenticate, restrictTo(PARTNER), setTicketPriceValidation, validate, scheduleController.setScheduleTicketPrice);
router.put('/:id/ticket-prices/:ticketPriceId', authenticate, restrictTo(PARTNER), setTicketPriceValidation, validate, scheduleController.setScheduleTicketPrice);

// Temporary aliases for clients that still use the old ambiguous URL.
router.get('/:id/tickets/:ticketPriceId', authenticate, restrictTo(PARTNER), scheduleController.getScheduleTicketPriceDetail);
router.get('/:id/tickets', authenticate, restrictTo(PARTNER), scheduleController.getScheduleTicketPrices);
router.post('/:id/tickets', authenticate, restrictTo(PARTNER), setTicketPriceValidation, validate, scheduleController.setScheduleTicketPrice);
router.put('/:id/tickets/:ticketPriceId', authenticate, restrictTo(PARTNER), setTicketPriceValidation, validate, scheduleController.setScheduleTicketPrice);
router.post('/', authenticate, restrictTo(PARTNER), createScheduleValidation, validate, scheduleController.createSchedule);
router.put('/:id', authenticate, restrictTo(PARTNER), updateScheduleValidation, validate, scheduleController.updateSchedule);
router.delete('/:id', authenticate, restrictTo(PARTNER), scheduleController.deleteSchedule);

module.exports = router;
