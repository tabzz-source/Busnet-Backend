const partnerSubscriptionService = require('../../services/partnerSubscription.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

const getMySubscriptions = async (req, res) => {
    try {
        const result = await partnerSubscriptionService.getMySubscriptions(
            req.user?.id,
            req.query
        );

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getOverview = asyncHandler(async (req, res) => {
    const data = await partnerSubscriptionService.getOverview(req.user.id);
    return successResponse(res, 200, 'Subscription overview retrieved successfully', data);
});

const createRenewal = asyncHandler(async (req, res) => {
    const data = await partnerSubscriptionService.createRenewal(req.user.id);
    return successResponse(
        res,
        data.reused ? 200 : 201,
        data.reused
            ? 'An existing pending renewal payment was returned'
            : 'Renewal payment created successfully',
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
    getMySubscriptions,
    getOverview,
    createRenewal,
    getRenewalStatus,
    cancelRenewal
};
