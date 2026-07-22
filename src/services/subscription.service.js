const SubscriptionPlan = require('../models/SubscriptionPlan');
const PartnerSubscription = require('../models/PartnerSubscription');
const AppError = require('../utils/AppError');

// The plan catalog is naturally small (a handful of pricing tiers), so the
// admin list intentionally still returns everything in one page rather than
// true pagination — this cap just guards against pathological growth instead
// of leaving the query fully unbounded.
const MAX_PLANS_PER_QUERY = 500;

/**
 * Get all active subscription plans sorted by price ascending
 */
const getActivePlans = async () => {
    const plans = await SubscriptionPlan.find({ status: 'ACTIVE' }).sort({ price: 1 });
    return plans;
};

// Annotates each plan with how many partners currently hold an ACTIVE
// subscription against it, so the admin UI can show a real number instead of
// a hardcoded placeholder, and so callers can decide whether it's safe to
// deactivate/delete a plan.
const withActiveSubscriberCounts = async (plans) => {
    const planIds = plans.map((p) => p._id);
    const counts = await PartnerSubscription.aggregate([
        { $match: { planId: { $in: planIds }, subscriptionStatus: 'ACTIVE' } },
        { $group: { _id: '$planId', count: { $sum: 1 } } }
    ]);
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

    return plans.map((p) => ({ ...p, activeSubscriberCount: countMap.get(p._id.toString()) || 0 }));
};

// ============================
// ADMIN SUBSCRIPTION MANAGEMENT
// ============================

const getAllPlans = async ({ status, limit } = {}) => {
    const filter = status ? { status } : { status: { $ne: 'DELETED' } };
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || MAX_PLANS_PER_QUERY, 1), MAX_PLANS_PER_QUERY);

    const plans = await SubscriptionPlan.find(filter).sort({ createdAt: -1 }).limit(limitNum).lean();
    return withActiveSubscriberCounts(plans);
};

const getPlanById = async (planId) => {
    const plan = await SubscriptionPlan.findById(planId).lean();

    if (!plan) {
        throw new AppError('Subscription plan not found', 404);
    }

    const [withCount] = await withActiveSubscriberCounts([plan]);
    return withCount;
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

    // Deactivating doesn't kick out existing subscribers (they keep the plan
    // until it expires) — but the caller needs the real count to warn the
    // admin, instead of the frontend showing a purely cosmetic notice.
    const activeSubscriberCount = await PartnerSubscription.countDocuments({ planId, subscriptionStatus: 'ACTIVE' });

    return { ...plan.toObject(), activeSubscriberCount };
};

const deletePlan = async (planId) => {
    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
        throw new AppError('Subscription plan not found', 404);
    }

    if (plan.status === 'DELETED') {
        throw new AppError('Subscription plan is already deleted', 409);
    }

    // Unlike deactivation, delete has no "undo" path in the admin UI — block
    // it outright while partners are actively subscribed, rather than silently
    // leaving their PartnerSubscription.planId pointing at a deleted plan.
    const activeSubscriberCount = await PartnerSubscription.countDocuments({ planId, subscriptionStatus: 'ACTIVE' });
    if (activeSubscriberCount > 0) {
        throw new AppError(
            `Cannot delete this plan — ${activeSubscriberCount} partner(s) are actively subscribed to it. Deactivate it instead, or wait until their subscriptions lapse.`,
            409
        );
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
