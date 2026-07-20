const mongoose = require('mongoose');
const TicketPrice = require('../models/TicketPrice');
const PricingAuditLog = require('../models/PricingAuditLog');
const Schedule = require('../models/Schedule');
const AppError = require('../utils/AppError');

const getEffectiveStatus = (ticketPrice, now) => {
    if (now < ticketPrice.effectiveFrom) return 'UPCOMING';
    if (ticketPrice.effectiveTo && now > ticketPrice.effectiveTo) return 'EXPIRED';
    return 'ACTIVE';
};

const getEffectiveCountdown = (ticketPrice, now, effectiveStatus) => {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    if (effectiveStatus === 'UPCOMING') {
        const days = Math.ceil((ticketPrice.effectiveFrom.getTime() - now.getTime()) / millisecondsPerDay);
        return {
            type: 'STARTS_IN',
            daysRemaining: days,
            text: `${days} ${days === 1 ? 'DAY' : 'DAYS'} UNTIL START`
        };
    }

    if (effectiveStatus === 'EXPIRED') {
        return { type: 'ENDED', daysRemaining: 0, text: 'ENDED' };
    }

    if (!ticketPrice.effectiveTo) {
        return { type: 'NO_END_DATE', daysRemaining: null, text: 'NO END DATE' };
    }

    const days = Math.max(
        Math.ceil((ticketPrice.effectiveTo.getTime() - now.getTime()) / millisecondsPerDay),
        0
    );
    return {
        type: 'ENDS_IN',
        daysRemaining: days,
        text: `${days} ${days === 1 ? 'DAY' : 'DAYS'} LEFT`
    };
};

const toPricingSnapshot = (ticketPrice) => ({
    seatType: ticketPrice.seatType,
    price: ticketPrice.price,
    discount: ticketPrice.discount,
    finalPrice: ticketPrice.price - ticketPrice.discount,
    effectiveFrom: ticketPrice.effectiveFrom,
    effectiveTo: ticketPrice.effectiveTo,
    isActive: ticketPrice.isActive
});

const getTicketPricesBySchedule = async (partnerId, scheduleId, query = {}) => {
    if (!mongoose.isValidObjectId(scheduleId)) {
        throw new AppError('Invalid schedule ID', 400);
    }

    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    // Checking partnerId here prevents one partner from viewing another partner's fares.
    const schedule = await Schedule.findOne({
        _id: scheduleId,
        partnerId,
        isActive: true
    })
        .select('scheduleCode basePrice departureTime arrivalTime recurrenceType recurrenceRule routeId busId')
        .populate(
            'routeId',
            'routeName origin_province origin_provinceName origin_district origin_districtName destination_province destination_provinceName destination_district destination_districtName distanceKm estimatedDuration'
        )
        .populate('busId', 'busName licensePlate busType totalSeats')
        .lean();

    if (!schedule) {
        throw new AppError('Schedule not found or does not belong to your account', 404);
    }

    const filter = {
        scheduleId: schedule._id,
        partnerId
    };

    if (query.includeInactive !== 'true') {
        filter.isActive = true;
    }

    const [ticketPrices, total] = await Promise.all([
        TicketPrice.find(filter)
            .select('seatType price discount effectiveFrom effectiveTo isActive createdAt updatedAt')
            // Matches TicketPrice's { scheduleId, seatType, effectiveFrom } index order.
            .sort({ seatType: 1, effectiveFrom: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        TicketPrice.countDocuments(filter)
    ]);

    const now = new Date();
    const tickets = ticketPrices.map((ticketPrice) => ({
        ...ticketPrice,
        basePrice: ticketPrice.price,
        finalPrice: ticketPrice.price - ticketPrice.discount,
        effectiveStatus: getEffectiveStatus(ticketPrice, now)
    }));

    return {
        schedule: {
            _id: schedule._id,
            scheduleCode: schedule.scheduleCode,
            basePrice: schedule.basePrice,
            departureTime: schedule.departureTime,
            arrivalTime: schedule.arrivalTime,
            recurrenceType: schedule.recurrenceType,
            recurrenceRule: schedule.recurrenceRule,
            route: schedule.routeId,
            bus: schedule.busId
        },
        tickets,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

const getTicketPriceDetail = async (partnerId, scheduleId, ticketPriceId) => {
    if (!mongoose.isValidObjectId(scheduleId)) {
        throw new AppError('Invalid schedule ID', 400);
    }

    if (!mongoose.isValidObjectId(ticketPriceId)) {
        throw new AppError('Invalid ticket price ID', 400);
    }

    // Do not filter by isActive: the detail screen must also show disabled tiers.
    const ticketPrice = await TicketPrice.findOne({
        _id: ticketPriceId,
        scheduleId,
        partnerId
    })
        .populate({
            path: 'scheduleId',
            match: { partnerId },
            select: 'scheduleCode basePrice departureTime arrivalTime recurrenceType recurrenceRule operationNotes isActive routeId busId',
            populate: [
                {
                    path: 'routeId',
                    select: 'routeName origin_province origin_provinceName origin_district origin_districtName origin_representativeAddress origin_representativeLat origin_representativeLng destination_province destination_provinceName destination_district destination_districtName destination_representativeAddress destination_representativeLat destination_representativeLng distanceKm estimatedDuration isActive'
                },
                {
                    path: 'busId',
                    select: 'busName licensePlate busType totalSeats amenities status isActive'
                }
            ]
        })
        .lean();

    if (!ticketPrice || !ticketPrice.scheduleId) {
        throw new AppError('Ticket price not found or does not belong to your account', 404);
    }

    const schedule = ticketPrice.scheduleId;
    const now = new Date();
    const effectiveStatus = getEffectiveStatus(ticketPrice, now);
    const finalPrice = ticketPrice.price - ticketPrice.discount;
    const markdownPercentage = ticketPrice.price > 0
        ? Number(((ticketPrice.discount / ticketPrice.price) * 100).toFixed(2))
        : 0;

    return {
        ticket: {
            _id: ticketPrice._id,
            seatType: ticketPrice.seatType,
            isActive: ticketPrice.isActive,
            basePrice: ticketPrice.price,
            discount: ticketPrice.discount,
            finalPrice,
            markdownPercentage,
            effectiveFrom: ticketPrice.effectiveFrom,
            effectiveTo: ticketPrice.effectiveTo,
            effectiveStatus,
            countdown: getEffectiveCountdown(ticketPrice, now, effectiveStatus),
            createdAt: ticketPrice.createdAt,
            updatedAt: ticketPrice.updatedAt
        },
        schedule: {
            _id: schedule._id,
            scheduleCode: schedule.scheduleCode,
            basePrice: schedule.basePrice,
            departureTime: schedule.departureTime,
            arrivalTime: schedule.arrivalTime,
            recurrenceType: schedule.recurrenceType,
            recurrenceRule: schedule.recurrenceRule,
            operationNotes: schedule.operationNotes,
            isActive: schedule.isActive,
            route: schedule.routeId,
            bus: schedule.busId
        }
    };
};

const setTicketPrice = async (partnerId, scheduleId, ticketPriceId, data) => {
    if (!mongoose.isValidObjectId(scheduleId)) {
        throw new AppError('Invalid schedule ID', 400);
    }

    if (ticketPriceId && !mongoose.isValidObjectId(ticketPriceId)) {
        throw new AppError('Invalid ticket price ID', 400);
    }

    const price = Number(data.price);
    const discount = data.discount === undefined ? 0 : Number(data.discount);
    const effectiveFrom = new Date(data.effectiveFrom);
    const effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null;

    if (discount > price) {
        throw new AppError('Discount cannot exceed the base price', 400);
    }

    if (effectiveTo && effectiveFrom >= effectiveTo) {
        throw new AppError('Effective from must be earlier than effective to', 400);
    }

    const executeSetPrice = async (session = null) => {
        const useSession = (query) => (session ? query.session(session) : query);

        const schedule = await useSession(Schedule.findOne({
                _id: scheduleId,
                partnerId,
                isActive: true
            }));

        if (!schedule) {
            throw new AppError('Schedule not found or does not belong to your account', 404);
        }

        let ticketPrice = null;
        if (ticketPriceId) {
            ticketPrice = await useSession(TicketPrice.findOne({
                    _id: ticketPriceId,
                    scheduleId,
                    partnerId
                }));

            if (!ticketPrice) {
                throw new AppError('Ticket price not found or does not belong to your account', 404);
            }
        }

        const targetIsActive = data.isActive !== undefined
            ? data.isActive
            : (ticketPrice ? ticketPrice.isActive : true);

        if (targetIsActive) {
            const overlapFilter = {
                scheduleId,
                partnerId,
                seatType: data.seatType.trim(),
                isActive: true,
                effectiveFrom: effectiveTo ? { $lte: effectiveTo } : { $exists: true },
                $or: [
                    { effectiveTo: null },
                    { effectiveTo: { $gte: effectiveFrom } }
                ]
            };

            if (ticketPrice) {
                overlapFilter._id = { $ne: ticketPrice._id };
            }

            let overlapQuery = TicketPrice.findOne(overlapFilter)
                .select('_id effectiveFrom effectiveTo');
            overlapQuery = useSession(overlapQuery);
            const overlappingPrice = await overlapQuery.lean();

            if (overlappingPrice) {
                throw new AppError(
                    'The effective period overlaps an active price configuration for this seat type',
                    409
                );
            }
        }

        const before = ticketPrice ? toPricingSnapshot(ticketPrice) : null;
        const action = ticketPrice ? 'UPDATE' : 'CREATE';

        if (ticketPrice) {
            ticketPrice.seatType = data.seatType.trim();
            ticketPrice.price = price;
            ticketPrice.discount = discount;
            ticketPrice.effectiveFrom = effectiveFrom;
            ticketPrice.effectiveTo = effectiveTo;
            if (data.isActive !== undefined) ticketPrice.isActive = data.isActive;
            await ticketPrice.save(session ? { session } : {});
        } else {
            [ticketPrice] = await TicketPrice.create([{
                scheduleId,
                partnerId,
                seatType: data.seatType.trim(),
                price,
                discount,
                effectiveFrom,
                effectiveTo,
                isActive: targetIsActive
            }], session ? { session } : {});
        }

        const after = toPricingSnapshot(ticketPrice);
        const previous = before || { price: 0, discount: 0, finalPrice: 0 };
        let auditLog;

        try {
            [auditLog] = await PricingAuditLog.create([{
                partnerId,
                scheduleId,
                ticketPriceId: ticketPrice._id,
                action,
                actorRole: 'PARTNER',
                before,
                after,
                financialDelta: {
                    basePrice: after.price - previous.price,
                    discount: after.discount - previous.discount,
                    finalPrice: after.finalPrice - previous.finalPrice
                },
                actionAt: new Date()
            }], session ? { session } : {});
        } catch (error) {
            // Standalone MongoDB has no transactions, so compensate if audit persistence fails.
            if (!session) {
                if (action === 'CREATE') {
                    await TicketPrice.deleteOne({ _id: ticketPrice._id, partnerId });
                } else {
                    ticketPrice.seatType = before.seatType;
                    ticketPrice.price = before.price;
                    ticketPrice.discount = before.discount;
                    ticketPrice.effectiveFrom = before.effectiveFrom;
                    ticketPrice.effectiveTo = before.effectiveTo;
                    ticketPrice.isActive = before.isActive;
                    await ticketPrice.save();
                }
            }
            throw error;
        }

        return {
            created: action === 'CREATE',
            action,
            ticket: {
                _id: ticketPrice._id,
                ...after,
                basePrice: after.price,
                markdownPercentage: after.price > 0
                    ? Number(((after.discount / after.price) * 100).toFixed(2))
                    : 0
            },
            auditLogId: auditLog._id
        };
    };

    const topologyType = mongoose.connection.client?.topology?.description?.type;
    if (topologyType === 'Single') {
        return executeSetPrice();
    }

    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await executeSetPrice(session);
        });
        return result;
    } finally {
        await session.endSession();
    }
};

module.exports = { getTicketPricesBySchedule, getTicketPriceDetail, setTicketPrice };
