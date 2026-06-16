const SubscriptionPlan = require('../models/SubscriptionPlan');

/**
 * Get all active subscription plans sorted by price ascending
 */
const getActivePlans = async () => {
    const plans = await SubscriptionPlan.find({ status: 'ACTIVE' }).sort({ price: 1 });
    return plans;
};

module.exports = {
    getActivePlans
};
