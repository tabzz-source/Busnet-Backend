const partnerSubscriptionService = require('../../services/partnerSubscription.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

const getOverview = asyncHandler(async (req, res) => {
    const data = await partnerSubscriptionService.getOverview(req.user.id);
    return successResponse(res, 200, 'Subscription overview retrieved successfully', data);
});

const getMySubscriptions = asyncHandler(async (req, res) => {
    const result = await partnerSubscriptionService.getMySubscriptions(req.user.id, req.query);
    return res.status(200).json({ success: true, ...result });
});

const getRenewalOptions = asyncHandler(async (req, res) => {
    const data = await partnerSubscriptionService.getRenewalOptions(req.user.id);
    return successResponse(res, 200, 'Renewal plan options retrieved successfully', data);
});

const createExtension = asyncHandler(async (req, res) => {
    const data = await partnerSubscriptionService.createExtension(req.user.id);
    return successResponse(
        res,
        data.reused ? 200 : 201,
        data.reused
            ? 'An existing pending extension payment was returned'
            : 'Extension payment created successfully',
        data
    );
});

const createRenewal = asyncHandler(async (req, res) => {
    const data = await partnerSubscriptionService.createRenewal(req.user.id, req.body.planId);
    return successResponse(
        res,
        data.reused ? 200 : 201,
        data.reused
            ? 'An existing pending renewal payment was returned'
            : 'Renewal payment for the selected plan created successfully',
        data
    );
});

const getRenewalStatus = asyncHandler(async (req, res) => {
    const data = await partnerSubscriptionService.getRenewalStatus(
        req.user.id,
        req.params.transactionId
    );
    return successResponse(res, 200, 'Renewal status retrieved successfully', data);
});

const cancelRenewal = asyncHandler(async (req, res) => {
    const data = await partnerSubscriptionService.cancelRenewal(
        req.user.id,
        req.params.transactionId
    );
    return successResponse(res, 200, 'Renewal payment cancelled successfully', data);
});

module.exports = {
    getOverview,
    getMySubscriptions,
    getRenewalOptions,
    createExtension,
    createRenewal,
    getRenewalStatus,
    cancelRenewal
};
