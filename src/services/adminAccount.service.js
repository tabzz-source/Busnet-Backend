const Account = require('../models/Account');
const Booking = require('../models/Booking');
const BanHistory = require('../models/BanHistory');
const AppError = require('../utils/AppError');
const { CUSTOMER } = require('../constants/roles');
const { resolveAccountStatus } = require('./banExpiry.service');

const listSelect = '_id username email phone fullName status profilePicture isEmailVerified isPhoneVerified banCounts createdAt updatedAt';
const detailSelect = `${listSelect} gender dob`;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getCustomers = async ({ status, search, page = 1, limit = 10 }) => {
    const filter = { role: CUSTOMER, deletedAt: null };

    if (status) {
        filter.status = status;
    }

    if (search) {
        const regex = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [{ fullName: regex }, { email: regex }, { username: regex }, { phone: regex }];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
    const skip = (pageNum - 1) * limitNum;

    // Stat cards summarize the whole customer base, not just the current
    // page/filter — counted separately from the paginated `filter` query.
    const baseFilter = { role: CUSTOMER, deletedAt: null };
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [customers, total, active, banned, newThisMonth] = await Promise.all([
        Account.find(filter).select(listSelect).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        Account.countDocuments(filter),
        Account.countDocuments({ ...baseFilter, status: 'ACTIVE' }),
        Account.countDocuments({ ...baseFilter, status: 'BANNED' }),
        Account.countDocuments({ ...baseFilter, createdAt: { $gte: startOfMonth } })
    ]);

    // Self-heal any TEMPORARY bans that have quietly expired since they were
    // last looked at — bounded by limitNum (capped at 100), so this list
    // endpoint never triggers more than that many extra lookups.
    await Promise.all(customers.map(async (c) => {
        if (c.status === 'BANNED') {
            c.status = await resolveAccountStatus(c._id, c.status);
        }
    }));

    return {
        customers,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1
        },
        stats: { active, banned, newThisMonth }
    };
};

const getCustomerDetail = async (customerId) => {
    const customer = await Account.findOne({ _id: customerId, role: CUSTOMER, deletedAt: null })
        .select(detailSelect)
        .lean();

    if (!customer) {
        throw new AppError('Customer not found', 404);
    }

    if (customer.status === 'BANNED') {
        customer.status = await resolveAccountStatus(customer._id, customer.status);
    }

    const [bookingStats, banHistory] = await Promise.all([
        Booking.aggregate([
            { $match: { customerId: customer._id } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        BanHistory.find({ accountId: customerId }).sort({ createdAt: -1 }).limit(5).lean()
    ]);

    return {
        customer,
        bookingStats,
        banHistory
    };
};

const updateCustomerStatus = async (customerId, { status, reason, type, expiredAt }, adminId) => {
    const customer = await Account.findOne({ _id: customerId, role: CUSTOMER, deletedAt: null });

    if (!customer) {
        throw new AppError('Customer not found', 404);
    }

    if (customer.status === status) {
        throw new AppError(`Customer account is already ${status}`, 409);
    }

    if (status === 'BANNED') {
        customer.banCounts += 1;

        await BanHistory.create({
            accountId: customer._id,
            bannedBy: adminId,
            banCounts: customer.banCounts,
            type: type || 'PERMANENT',
            reason: reason || '',
            expiredAt: expiredAt || null,
            status: 'ACTIVE'
        });
    } else {
        await BanHistory.updateMany(
            { accountId: customer._id, status: 'ACTIVE' },
            { status: 'REVOKED', unbannedAt: new Date() }
        );
    }

    customer.status = status;
    await customer.save();

    return {
        _id: customer._id,
        status: customer.status,
        banCounts: customer.banCounts
    };
};

const deleteCustomer = async (customerId) => {
    const customer = await Account.findOne({ _id: customerId, role: CUSTOMER, deletedAt: null });

    if (!customer) {
        throw new AppError('Customer not found', 404);
    }

    customer.status = 'DELETED';
    customer.deletedAt = new Date();
    await customer.save();

    return { message: 'Customer deleted successfully' };
};

module.exports = {
    getCustomers,
    getCustomerDetail,
    updateCustomerStatus,
    deleteCustomer
};
