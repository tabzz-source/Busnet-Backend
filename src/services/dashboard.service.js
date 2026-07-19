const Account = require('../models/Account');
const Report = require('../models/Report');
const Transaction = require('../models/Transaction');
const Route = require('../models/Route');
const { CUSTOMER, PARTNER } = require('../constants/roles');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_UNIT = 'day';
const DEFAULT_AMOUNT = 30;

// Refunds must reduce revenue, not add to it — REFUND transactions store a
// positive `amount` (the amount refunded), so it needs to be negated here
// wherever "revenue" is summed across all transaction types.
const NET_AMOUNT_EXPR = {
    $cond: [{ $eq: ['$transactionType', 'REFUND'] }, { $multiply: ['$amount', -1] }, '$amount']
};

// null means "no baseline to compare against" (previous period was zero) —
// the frontend shows a "New" badge instead of a misleading/infinite percent.
const percentChange = (current, previous) => {
    if (previous === 0) {
        return current === 0 ? 0 : null;
    }
    return Math.round(((current - previous) / previous) * 1000) / 10;
};

// Calendar-aware: "N months ago" subtracts whole months (28-31 days) rather
// than a fixed day count, so period boundaries land on the same day-of-month
// instead of drifting — matches how the revenue chart already buckets months.
const getPeriodStart = (referenceDate, unit, amount) => {
    if (unit === 'month') {
        return new Date(referenceDate.getFullYear(), referenceDate.getMonth() - amount, referenceDate.getDate());
    }
    return new Date(referenceDate.getTime() - amount * MS_PER_DAY);
};

// Every figure here is "how much of this happened in the selected period",
// not a running total — e.g. "Total Partners" is new partner signups within
// the period, not the all-time partner count. Keeps every card + its %
// change badge scoped to the same window the admin picked.
const getAdminDashboardStats = async (unit = DEFAULT_UNIT, amount = DEFAULT_AMOUNT) => {
    const now = new Date();
    const periodStart = getPeriodStart(now, unit, amount);
    const prevPeriodStart = getPeriodStart(periodStart, unit, amount);

    const [
        usersThisPeriod, usersPrevPeriod,
        partnersThisPeriod, partnersPrevPeriod,
        reportsThisPeriod, reportsPrevPeriod,
        revenueThisPeriodResult, revenuePrevPeriodResult,
        activeRoutesThisPeriod, activeRoutesPrevPeriod
    ] = await Promise.all([
        Account.countDocuments({ role: CUSTOMER, deletedAt: null, createdAt: { $gte: periodStart } }),
        Account.countDocuments({ role: CUSTOMER, deletedAt: null, createdAt: { $gte: prevPeriodStart, $lt: periodStart } }),

        Account.countDocuments({ role: PARTNER, deletedAt: null, createdAt: { $gte: periodStart } }),
        Account.countDocuments({ role: PARTNER, deletedAt: null, createdAt: { $gte: prevPeriodStart, $lt: periodStart } }),

        Report.countDocuments({ createdAt: { $gte: periodStart } }),
        Report.countDocuments({ createdAt: { $gte: prevPeriodStart, $lt: periodStart } }),

        Transaction.aggregate([
            { $match: { status: 'SUCCESS', transactionDate: { $gte: periodStart } } },
            { $group: { _id: null, total: { $sum: NET_AMOUNT_EXPR }, count: { $sum: 1 } } }
        ]),
        Transaction.aggregate([
            { $match: { status: 'SUCCESS', transactionDate: { $gte: prevPeriodStart, $lt: periodStart } } },
            { $group: { _id: null, total: { $sum: NET_AMOUNT_EXPR }, count: { $sum: 1 } } }
        ]),

        Route.countDocuments({ isActive: true, deletedAt: null, createdAt: { $gte: periodStart } }),
        Route.countDocuments({ isActive: true, deletedAt: null, createdAt: { $gte: prevPeriodStart, $lt: periodStart } })
    ]);

    const revenueThisPeriod = revenueThisPeriodResult[0]?.total || 0;
    const revenuePrevPeriod = revenuePrevPeriodResult[0]?.total || 0;
    const bookingsThisPeriod = revenueThisPeriodResult[0]?.count || 0;
    const bookingsPrevPeriod = revenuePrevPeriodResult[0]?.count || 0;

    return {
        revenue: { value: revenueThisPeriod, change: percentChange(revenueThisPeriod, revenuePrevPeriod) },
        totalBookings: { value: bookingsThisPeriod, change: percentChange(bookingsThisPeriod, bookingsPrevPeriod) },
        partners: { value: partnersThisPeriod, change: percentChange(partnersThisPeriod, partnersPrevPeriod) },
        users: { value: usersThisPeriod, change: percentChange(usersThisPeriod, usersPrevPeriod) },
        activeRoutes: { value: activeRoutesThisPeriod, change: percentChange(activeRoutesThisPeriod, activeRoutesPrevPeriod) },
        reports: { value: reportsThisPeriod, change: percentChange(reportsThisPeriod, reportsPrevPeriod) }
    };
};

const getDailyRevenue = async (days = 7) => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));

    const result = await Transaction.aggregate([
        {
            $match: {
                status: 'SUCCESS',
                transactionDate: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$transactionDate' },
                    month: { $month: '$transactionDate' },
                    day: { $dayOfMonth: '$transactionDate' }
                },
                revenue: { $sum: NET_AMOUNT_EXPR }
            }
        }
    ]);

    const revenueByDate = new Map(
        result.map((item) => [`${item._id.year}-${item._id.month}-${item._id.day}`, item.revenue])
    );

    const chart = [];
    for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        chart.push({
            date: date.toISOString().slice(0, 10),
            label: date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
            revenue: revenueByDate.get(key) || 0
        });
    }

    return chart;
};

const getMonthlyRevenue = async (months = 6) => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const result = await Transaction.aggregate([
        {
            $match: {
                status: 'SUCCESS',
                transactionDate: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$transactionDate' },
                    month: { $month: '$transactionDate' }
                },
                revenue: { $sum: NET_AMOUNT_EXPR }
            }
        }
    ]);

    const revenueByMonth = new Map(
        result.map((item) => [`${item._id.year}-${item._id.month}`, item.revenue])
    );

    const chart = [];
    for (let i = 0; i < months; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
        const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        chart.push({
            date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
            label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            revenue: revenueByMonth.get(key) || 0
        });
    }

    return chart;
};

const getRevenueChart = async (unit = 'day', amount) => {
    if (unit === 'month') {
        return getMonthlyRevenue(amount || 6);
    }
    return getDailyRevenue(amount || 7);
};

// Scoped to the same period as getAdminDashboardStats so the breakdown
// table's "Total" row always matches the Platform Revenue card exactly.
const getRevenueBreakdown = async (unit = DEFAULT_UNIT, amount = DEFAULT_AMOUNT) => {
    const now = new Date();
    const periodStart = getPeriodStart(now, unit, amount);

    const breakdown = await Transaction.aggregate([
        { $match: { status: 'SUCCESS', transactionDate: { $gte: periodStart } } },
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

const getExportData = async (unit = 'day', amount, generatedBy = 'BusNet Admin') => {
    const resolvedAmount = amount || (unit === 'month' ? 6 : 7);

    const [stats, revenueBreakdown, revenueChart] = await Promise.all([
        getAdminDashboardStats(unit, resolvedAmount),
        getRevenueBreakdown(unit, resolvedAmount),
        getRevenueChart(unit, resolvedAmount)
    ]);

    return {
        generatedAt: new Date(),
        generatedBy,
        period: { unit, amount: resolvedAmount },
        stats,
        revenueBreakdown,
        revenueChart
    };
};

module.exports = {
    getAdminDashboardStats,
    getRevenueChart,
    getRevenueBreakdown,
    getExportData
};
