const Account = require('../models/Account');
const Report = require('../models/Report');
const Transaction = require('../models/Transaction');
const { CUSTOMER, PARTNER } = require('../constants/roles');

const getAdminDashboardStats = async () => {
    const [users, partners, reports, revenueResult] = await Promise.all([
        Account.countDocuments({ role: CUSTOMER, deletedAt: null }),
        Account.countDocuments({ role: PARTNER, deletedAt: null }),
        Report.countDocuments({ status: 'PENDING' }),
        Transaction.aggregate([
            { $match: { status: 'SUCCESS' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ])
    ]);

    const revenue = revenueResult[0]?.total || 0;

    return { users, partners, reports, revenue };
};

const getRevenueBreakdown = async () => {
    const breakdown = await Transaction.aggregate([
        { $match: { status: 'SUCCESS' } },
        {
            $group: {
                _id: '$transactionType',
                count: { $sum: 1 },
                total: { $sum: '$amount' }
            }
        },
        { $sort: { total: -1 } }
    ]);

    return breakdown.map((item) => ({
        type: item._id,
        count: item.count,
        total: item.total
    }));
};

module.exports = {
    getAdminDashboardStats,
    getRevenueBreakdown
};
