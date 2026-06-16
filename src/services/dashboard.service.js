const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { CUSTOMER, PARTNER } = require('../constants/roles');

const getAdminDashboardStats = async () => {
    const [users, partners, revenueResult] = await Promise.all([
        Account.countDocuments({ role: CUSTOMER, deletedAt: null }),
        Account.countDocuments({ role: PARTNER, deletedAt: null }),
        Transaction.aggregate([
            { $match: { status: 'SUCCESS' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
    ]);

    const revenue = revenueResult[0]?.total || 0;

    // Report model is not implemented yet, so there is nothing to count.
    const reports = 0;

    return { users, partners, reports, revenue };
};

module.exports = {
    getAdminDashboardStats
};
