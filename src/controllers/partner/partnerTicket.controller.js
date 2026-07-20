const partnerTicketService = require('../../services/partnerTicket.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

const getTickets = asyncHandler(async (req, res) => {
    const result = await partnerTicketService.getPartnerTickets(req.user.id, req.query);
    return successResponse(res, 200, 'Partner tickets fetched successfully', result);
});

const getTicketDetail = asyncHandler(async (req, res) => {
    const result = await partnerTicketService.getPartnerTicketDetail(
        req.user.id,
        req.params.ticketId
    );
    return successResponse(res, 200, 'Partner ticket detail fetched successfully', result);
});

module.exports = { getTickets, getTicketDetail };
