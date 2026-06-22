const subscriptionService = require('../../services/subscription.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

const getPlans = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const plans = await subscriptionService.getAllPlans({ status });

    return successResponse(res, 200, 'Subscription plan list fetched successfully', { plans });
});

const getPlanDetail = asyncHandler(async (req, res) => {
    const plan = await subscriptionService.getPlanById(req.params.id);

    return successResponse(res, 200, 'Subscription plan detail fetched successfully', { plan });
});

const createPlan = asyncHandler(async (req, res) => {
    const plan = await subscriptionService.createPlan(req.body);

    return successResponse(res, 201, 'Subscription plan created successfully', { plan });
});

const updatePlan = asyncHandler(async (req, res) => {
    const plan = await subscriptionService.updatePlan(req.params.id, req.body);

    return successResponse(res, 200, 'Subscription plan updated successfully', { plan });
});

const updatePlanStatus = asyncHandler(async (req, res) => {
    const plan = await subscriptionService.updatePlanStatus(req.params.id, req.body.status);
    const action = plan.status === 'ACTIVE' ? 'activated' : 'deactivated';

    return successResponse(res, 200, `Subscription plan ${action} successfully`, { plan });
});

const deletePlan = asyncHandler(async (req, res) => {
    const result = await subscriptionService.deletePlan(req.params.id);

    return successResponse(res, 200, result.message);
});

module.exports = {
    getPlans,
    getPlanDetail,
    createPlan,
    updatePlan,
    updatePlanStatus,
    deletePlan
};
