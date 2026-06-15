const PartnerInformation = require('../models/PartnerInformation');
const Account = require('../models/Account');
const Route = require('../models/Route');
const Schedule = require('../models/Schedule');
const Bus = require('../models/Bus');
const TicketPrice = require('../models/TicketPrice');
const SchedulePickupPoint = require('../models/SchedulePickupPoint');
const ScheduleDropoffPoint = require('../models/ScheduleDropoffPoint');
const AppError = require('../utils/AppError');

/**
 * Get list of verified operators with pagination and search
 */
const getVerifiedOperators = async (queryParams) => {
    const { page = 1, limit = 12, search, q } = queryParams;
    const searchQuery = search || q;

    // Step 1: Find all ACTIVE PARTNER accounts
    const accountFilter = { role: 'PARTNER', status: 'ACTIVE' };
    const activePartnerIds = await Account.find(accountFilter).select('_id').lean();
    const partnerIdList = activePartnerIds.map((a) => a._id);

    // Step 2: Build partner info filter (verified only)
    const partnerFilter = {
        accountId: { $in: partnerIdList },
        isVerified: true
    };

    if (searchQuery) {
        partnerFilter.$or = [
            { operatorName: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } }
        ];
    }

    const skipIndex = (page - 1) * limit;

    // Step 3: Query partner information with pagination
    const [operators, totalOperators] = await Promise.all([
        PartnerInformation.find(partnerFilter)
            .populate('accountId', 'fullName email profilePicture')
            .sort({ ratingAvg: -1, totalReviews: -1, createdAt: -1 })
            .skip(skipIndex)
            .limit(Number(limit))
            .lean(),
        PartnerInformation.countDocuments(partnerFilter)
    ]);

    // Step 4: For each operator, count active routes
    const operatorsWithStats = await Promise.all(
        operators.map(async (op) => {
            const routeCount = await Route.countDocuments({
                partnerId: op.accountId._id || op.accountId,
                isActive: true,
                deletedAt: null
            });

            return {
                _id: op._id,
                accountId: op.accountId._id || op.accountId,
                operatorName: op.operatorName,
                operatorPhone: op.operatorPhone,
                description: op.description,
                amenities: op.amenities,
                profilePicture: op.profilePicture,
                coverImage: op.coverImage,
                ratingAvg: op.ratingAvg,
                totalReviews: op.totalReviews,
                isVerified: op.isVerified,
                routeCount,
                account: op.accountId
            };
        })
    );

    const totalPages = Math.ceil(totalOperators / limit);

    return {
        operators: operatorsWithStats,
        pagination: {
            totalItems: totalOperators,
            totalPages,
            currentPage: Number(page),
            limit: Number(limit)
        }
    };
};

/**
 * Get detailed information for a single operator
 * Includes: partner info, routes, schedules, buses, prices, pickup/dropoff points
 */
const getOperatorDetail = async (operatorId) => {
    // Step 1: Find the partner information
    const partner = await PartnerInformation.findOne({ accountId: operatorId })
        .populate('accountId', 'fullName email profilePicture')
        .lean();

    if (!partner) {
        throw new AppError('Operator not found', 404);
    }

    // Step 2: Get all active routes for this operator
    const routes = await Route.find({
        partnerId: operatorId,
        isActive: true,
        deletedAt: null
    })
        .sort({ createdAt: -1 })
        .lean();

    // Step 3: For each route, get schedules with bus info, prices, pickup/dropoff points
    const routesWithDetails = await Promise.all(
        routes.map(async (route) => {
            const schedules = await Schedule.find({
                routeId: route._id,
                partnerId: operatorId,
                isActive: true
            })
                .populate('busId', 'busName licensePlate busType totalSeats amenities images')
                .sort({ departureTime: 1 })
                .lean();

            // For each schedule, get prices and pickup/dropoff points
            const schedulesWithDetails = await Promise.all(
                schedules.map(async (schedule) => {
                    const [prices, pickupPoints, dropoffPoints] = await Promise.all([
                        TicketPrice.find({
                            scheduleId: schedule._id,
                            isActive: true
                        })
                            .sort({ price: 1 })
                            .lean(),
                        SchedulePickupPoint.find({ scheduleId: schedule._id })
                            .sort({ orderIndex: 1 })
                            .lean(),
                        ScheduleDropoffPoint.find({ scheduleId: schedule._id })
                            .sort({ orderIndex: 1 })
                            .lean()
                    ]);

                    return {
                        ...schedule,
                        prices,
                        pickupPoints,
                        dropoffPoints
                    };
                })
            );

            return {
                ...route,
                schedules: schedulesWithDetails
            };
        })
    );

    return {
        partner: {
            _id: partner._id,
            accountId: partner.accountId._id || partner.accountId,
            operatorName: partner.operatorName,
            operatorPhone: partner.operatorPhone,
            description: partner.description,
            amenities: partner.amenities,
            policies: partner.policies,
            profilePicture: partner.profilePicture,
            coverImage: partner.coverImage,
            ratingAvg: partner.ratingAvg,
            totalReviews: partner.totalReviews,
            isVerified: partner.isVerified,
            verifiedAt: partner.verifiedAt,
            account: partner.accountId
        },
        routes: routesWithDetails
    };
};

module.exports = {
    getVerifiedOperators,
    getOperatorDetail
};
