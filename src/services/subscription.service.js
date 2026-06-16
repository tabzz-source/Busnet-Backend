const SubscriptionPlan = require('../models/SubscriptionPlan');
const AppError = require('../utils/AppError');

/**
 * Get all active subscription plans sorted by price ascending
 */
const getActivePlans = async () => {
    const plans = await SubscriptionPlan.find({ status: 'ACTIVE' }).sort({ price: 1 });
    return plans;
};

// ============================
// ADMIN SUBSCRIPTION MANAGEMENT
// ============================

const getAllPlans = async ({ status }) => {
    const filter = status ? { status } : { status: { $ne: 'DELETED' } };
    return SubscriptionPlan.find(filter).sort({ createdAt: -1 });
};

const getPlanById = async (planId) => {
    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
        throw new AppError('Subscription plan not found', 404);
    }

    return plan;
};

const createPlan = async (data) => {
    const existing = await SubscriptionPlan.findOne({ code: data.code.toUpperCase() });

    if (existing) {
        throw new AppError('A subscription plan with this code already exists', 409);
    }

    return SubscriptionPlan.create(data);
};

const updatePlan = async (planId, data) => {
    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
        throw new AppError('Subscription plan not found', 404);
    }

    if (plan.status === 'DELETED') {
        throw new AppError('Cannot update a deleted subscription plan', 400);
    }

    if (data.code && data.code.toUpperCase() !== plan.code) {
        const existing = await SubscriptionPlan.findOne({ code: data.code.toUpperCase(), _id: { $ne: planId } });

        if (existing) {
            throw new AppError('A subscription plan with this code already exists', 409);
        }
    }

    Object.assign(plan, data);
    await plan.save();

    return plan;
};

const updatePlanStatus = async (planId, status) => {
    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
        throw new AppError('Subscription plan not found', 404);
    }

    if (plan.status === 'DELETED') {
        throw new AppError('Cannot change status of a deleted subscription plan', 400);
    }

    if (plan.status === status) {
        throw new AppError(`Subscription plan is already ${status}`, 409);
    }

    plan.status = status;
    await plan.save();

    return plan;
};

const deletePlan = async (planId) => {
    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
        throw new AppError('Subscription plan not found', 404);
    }

    if (plan.status === 'DELETED') {
        throw new AppError('Subscription plan is already deleted', 409);
    }

    plan.status = 'DELETED';
    await plan.save();

    return { message: 'Subscription plan deleted successfully' };
};

module.exports = {
    getActivePlans,
    getAllPlans,
    getPlanById,
    createPlan,
    updatePlan,
    updatePlanStatus,
    deletePlan
};
