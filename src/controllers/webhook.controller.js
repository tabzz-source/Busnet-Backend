const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const bookingService = require('../services/booking.service');

const handleSepayWebhook = asyncHandler(async (req, res) => {
    const result = await bookingService.handleSepayWebhook(req.body || {});
    return successResponse(res, 200, 'Webhook processed successfully', result);
});

module.exports = {
    handleSepayWebhook
};
