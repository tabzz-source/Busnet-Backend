const express = require('express');
const partnerTicketController = require('../../controllers/partner/partnerTicket.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const { PARTNER } = require('../../constants/roles');

const router = express.Router();

router.use(authenticate, restrictTo(PARTNER));

router.get('/', partnerTicketController.getTickets);
router.get('/:ticketId', partnerTicketController.getTicketDetail);

module.exports = router;
