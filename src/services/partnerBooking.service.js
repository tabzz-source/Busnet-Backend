const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const BookingSeat = require('../models/BookingSeat');
const Trip = require('../models/Trip');
const Transaction = require('../models/Transaction');
const Ticket = require('../models/Ticket');
const PartnerInformation = require('../models/PartnerInformation');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');

const BOOKING_STATUSES = [
    'PENDING_PAYMENT',
    'CONFIRMED',
    'CANCEL_REQUESTED',
    'CANCELLED_BY_CUSTOMER',
    'CANCELLED_BY_OPERATOR',
    'COMPLETED',
    'NO_SHOW',
    'REFUNDED'
];

const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED', 'CANCELLED'];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseDate = (value, fieldName, endOfDay = false) => {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new AppError(`${fieldName} must be a valid date`, 400);
    }

    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        date.setUTCHours(23, 59, 59, 999);
    }

    return date;
};

const formatVnd = (amount) => `${new Intl.NumberFormat('vi-VN').format(Number(amount) || 0)} ₫`;

const formatDateTime = (date) => {
    if (!date) return null;
    return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).format(new Date(date));
};

const formatDate = (date) => {
    if (!date) return null;
    return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(new Date(date));
};

const formatMinutes = (minutes) => {
    if (minutes === null || minutes === undefined) return null;
    const value = Number(minutes);
    const hours = Math.floor(value / 60).toString().padStart(2, '0');
    const remainingMinutes = (value % 60).toString().padStart(2, '0');
    return `${hours}:${remainingMinutes}`;
};

const getDepartureAt = (trip) => new Date(
    new Date(trip.departureDate).getTime() + Number(trip.actualDepartureTime) * 60 * 1000
);

const resolveRefundPolicy = (policies = {}) => {
    const cancellationText = String(policies.cancellation || '');
    const refundText = String(policies.refund || '');
    const hourMatch = cancellationText.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hours?|giờ)/i);
    const percentMatch = refundText.match(/(\d+(?:[.,]\d+)?)\s*%/);
    const isFreeCancellation = /free|miễn\s*phí/i.test(cancellationText);

    const minimumHoursBeforeDeparture = hourMatch
        ? Number(hourMatch[1].replace(',', '.'))
        : 0;
    const refundPercentage = percentMatch
        ? Number(percentMatch[1].replace(',', '.'))
        : (isFreeCancellation ? 100 : 0);

    return {
        minimumHoursBeforeDeparture,
        refundPercentage: Math.min(Math.max(refundPercentage, 0), 100),
        cancellationPolicy: cancellationText || null,
        refundPolicy: refundText || null
    };
};

const notifyCancellationResult = async (booking, decision, refundAmount, response) => {
    try {
        const approved = decision === 'APPROVE';
        await Notification.create({
            accountId: booking.customerId,
            type: approved ? 'BOOKING_CANCELLATION_APPROVED' : 'BOOKING_CANCELLATION_REJECTED',
            title: approved ? 'Cancellation request approved' : 'Cancellation request rejected',
            message: approved
                ? `Booking ${booking.bookingCode} was cancelled. Refund: ${formatVnd(refundAmount)}.`
                : `Cancellation request for booking ${booking.bookingCode} was rejected.`,
            data: {
                bookingId: booking._id,
                bookingCode: booking.bookingCode,
                decision,
                refundAmount,
                response
            }
        });
        return true;
    } catch (error) {
        console.error('[Partner Booking] Failed to create cancellation notification:', error.message);
        return false;
    }
};

const getPartnerBookings = async (partnerId, query = {}) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const partnerObjectId = new mongoose.Types.ObjectId(partnerId);
    const bookingMatch = { partnerId: partnerObjectId };

    const bookingStatus = String(query.bookingStatus || query.status || '').trim().toUpperCase();
    if (bookingStatus) {
        if (!BOOKING_STATUSES.includes(bookingStatus)) {
            throw new AppError(`bookingStatus must be one of: ${BOOKING_STATUSES.join(', ')}`, 400);
        }
        bookingMatch.status = bookingStatus;
    }

    const paymentStatus = String(query.paymentStatus || query.payment_status || '').trim().toUpperCase();
    if (paymentStatus) {
        if (!PAYMENT_STATUSES.includes(paymentStatus)) {
            throw new AppError(`paymentStatus must be one of: ${PAYMENT_STATUSES.join(', ')}`, 400);
        }
        bookingMatch.payment_status = paymentStatus;
    }

    if (query.tripId) {
        if (!mongoose.isValidObjectId(query.tripId)) {
            throw new AppError('Invalid trip ID', 400);
        }
        bookingMatch.tripId = new mongoose.Types.ObjectId(query.tripId);
    }

    let departureFrom = parseDate(query.departureFrom, 'departureFrom');
    let departureTo = parseDate(query.departureTo, 'departureTo', true);
    if (query.departureDate) {
        departureFrom = parseDate(query.departureDate, 'departureDate');
        departureTo = parseDate(query.departureDate, 'departureDate', true);
    }
    if (departureFrom && departureTo && departureFrom > departureTo) {
        throw new AppError('departureFrom must be earlier than departureTo', 400);
    }

    const sortBy = String(query.sortBy || 'createdAt');
    if (!['createdAt', 'departureTime'].includes(sortBy)) {
        throw new AppError('sortBy must be createdAt or departureTime', 400);
    }
    const sortDirection = String(query.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    const pipeline = [
        // Security boundary: scope bookings before performing any lookup or search.
        { $match: bookingMatch },
        {
            $lookup: {
                from: 'trips',
                localField: 'tripId',
                foreignField: '_id',
                as: 'trip'
            }
        },
        { $unwind: '$trip' },
        { $match: { 'trip.partnerId': partnerObjectId } },
        {
            $lookup: {
                from: 'routes',
                localField: 'trip.routeId',
                foreignField: '_id',
                as: 'route'
            }
        },
        { $unwind: { path: '$route', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'buses',
                localField: 'trip.busId',
                foreignField: '_id',
                as: 'bus'
            }
        },
        { $unwind: { path: '$bus', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'booking_seats_embedded',
                localField: '_id',
                foreignField: 'bookingId',
                as: 'seats'
            }
        },
        {
            $lookup: {
                from: 'transactions',
                localField: 'payment_transactionId',
                foreignField: '_id',
                as: 'transaction'
            }
        },
        { $unwind: { path: '$transaction', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'accounts',
                localField: 'customerId',
                foreignField: '_id',
                as: 'customer'
            }
        },
        { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } }
    ];

    if (departureFrom || departureTo) {
        const departureDate = {};
        if (departureFrom) departureDate.$gte = departureFrom;
        if (departureTo) departureDate.$lte = departureTo;
        pipeline.push({ $match: { 'trip.departureDate': departureDate } });
    }

    const search = String(query.search || '').trim().slice(0, 100);
    if (search) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        pipeline.push({
            $match: {
                $or: [
                    { bookingCode: pattern },
                    { passengerName: pattern },
                    { passengerPhone: pattern },
                    { 'trip.tripCode': pattern },
                    { 'route.routeName': pattern },
                    { 'route.origin_provinceName': pattern },
                    { 'route.destination_provinceName': pattern }
                ]
            }
        });
    }

    const sort = sortBy === 'departureTime'
        ? { 'trip.departureDate': sortDirection, 'trip.actualDepartureTime': sortDirection, _id: -1 }
        : { createdAt: sortDirection, _id: -1 };

    pipeline.push({
        $facet: {
            bookings: [
                { $sort: sort },
                { $skip: skip },
                { $limit: limit },
                {
                    $project: {
                        _id: 1,
                        bookingCode: 1,
                        status: 1,
                        total: 1,
                        customerNote: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        passenger: {
                            name: '$passengerName',
                            phone: '$passengerPhone',
                            email: '$passengerEmail',
                            customerId: '$customer._id',
                            accountName: '$customer.fullName'
                        },
                        pickupPoint: {
                            name: '$pickupPoint_name',
                            address: '$pickupPoint_address',
                            time: '$pickupPoint_time'
                        },
                        dropoffPoint: {
                            name: '$dropoffPoint_name',
                            address: '$dropoffPoint_address',
                            time: '$dropoffPoint_time'
                        },
                        seats: {
                            $map: {
                                input: '$seats',
                                as: 'seat',
                                in: {
                                    _id: '$$seat._id',
                                    seatCode: '$$seat.seatCode',
                                    seatType: '$$seat.seatType',
                                    price: '$$seat.price',
                                    discount: '$$seat.discount',
                                    finalPrice: '$$seat.finalPrice',
                                    passengerName: '$$seat.passengerName'
                                }
                            }
                        },
                        payment: {
                            status: '$payment_status',
                            amount: '$payment_amount',
                            paymentType: '$payment_paymentType',
                            transactionId: '$transaction._id',
                            transactionStatus: '$transaction.status',
                            gateway: '$transaction.gateway',
                            transactionDate: '$transaction.transactionDate'
                        },
                        trip: {
                            _id: '$trip._id',
                            tripCode: '$trip.tripCode',
                            departureDate: '$trip.departureDate',
                            actualDepartureTime: '$trip.actualDepartureTime',
                            actualArrivalTime: '$trip.actualArrivalTime',
                            status: '$trip.status'
                        },
                        route: {
                            _id: '$route._id',
                            routeName: '$route.routeName',
                            originProvinceName: '$route.origin_provinceName',
                            destinationProvinceName: '$route.destination_provinceName'
                        },
                        bus: {
                            _id: '$bus._id',
                            busName: '$bus.busName',
                            licensePlate: '$bus.licensePlate',
                            busType: '$bus.busType'
                        }
                    }
                }
            ],
            metadata: [{ $count: 'total' }]
        }
    });

    const [result] = await Booking.aggregate(pipeline);
    const total = result.metadata[0]?.total || 0;

    const bookings = result.bookings.map((booking) => ({
        ...booking,
        totalFormatted: formatVnd(booking.total),
        createdAtDisplay: formatDateTime(booking.createdAt),
        payment: {
            ...booking.payment,
            amountFormatted: formatVnd(booking.payment?.amount),
            transactionDateDisplay: formatDateTime(booking.payment?.transactionDate)
        },
        seats: booking.seats.map((seat) => ({
            ...seat,
            priceFormatted: formatVnd(seat.price),
            discountFormatted: formatVnd(seat.discount),
            finalPriceFormatted: formatVnd(seat.finalPrice)
        })),
        trip: {
            ...booking.trip,
            departureDateDisplay: formatDate(booking.trip?.departureDate),
            departureTimeDisplay: formatMinutes(booking.trip?.actualDepartureTime),
            arrivalTimeDisplay: formatMinutes(booking.trip?.actualArrivalTime)
        }
    }));

    return {
        bookings,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

const getPartnerBookingDetail = async (partnerId, bookingId) => {
    if (!mongoose.isValidObjectId(bookingId)) {
        throw new AppError('Invalid booking ID', 400);
    }

    // Fetch by ID first so the API can distinguish not found from forbidden as specified.
    const booking = await Booking.findById(bookingId).lean();
    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    if (String(booking.partnerId) !== String(partnerId)) {
        throw new AppError('You do not have permission to view this booking', 403);
    }

    const tripQuery = Trip.findOne({ _id: booking.tripId, partnerId })
        .select('scheduleId routeId busId tripCode departureDate actualDepartureTime actualArrivalTime status')
        .populate({
            path: 'scheduleId',
            select: 'scheduleCode departureTime arrivalTime recurrenceType operationNotes isActive'
        })
        .populate({
            path: 'routeId',
            select: 'routeName origin_provinceName origin_districtName origin_representativeAddress destination_provinceName destination_districtName destination_representativeAddress distanceKm estimatedDuration'
        })
        .populate({
            path: 'busId',
            select: 'busName licensePlate busType totalSeats amenities status'
        })
        .lean();

    const transactionQuery = booking.payment_transactionId
        ? Transaction.findOne({
            _id: booking.payment_transactionId,
            bookingId: booking._id,
            partnerId
        })
            .select('status amount currency gateway transactionDate referenceCode description')
            .lean()
        : Promise.resolve(null);

    const [trip, seats, transaction, tickets] = await Promise.all([
        tripQuery,
        BookingSeat.find({ bookingId: booking._id })
            .select('seatCode seatType price discount finalPrice passengerName')
            .sort({ seatCode: 1 })
            .lean(),
        transactionQuery,
        Ticket.find({ bookingId: booking._id, tripId: booking.tripId })
            .select('seatCode ticketCode checkInStatus checkedInAt ticketExpiredAt issuedAt status')
            .sort({ seatCode: 1 })
            .lean()
    ]);

    if (!trip) {
        throw new AppError('Booking trip information is unavailable', 409);
    }

    return {
        booking: {
            _id: booking._id,
            bookingCode: booking.bookingCode,
            status: booking.status,
            createdAt: booking.createdAt,
            createdAtDisplay: formatDateTime(booking.createdAt),
            confirmedAt: booking.confirmedAt,
            confirmedAtDisplay: formatDateTime(booking.confirmedAt),
            expiresAt: booking.expiresAt,
            expiresAtDisplay: formatDateTime(booking.expiresAt),
            updatedAt: booking.updatedAt
        },
        passenger: {
            name: booking.passengerName,
            phone: booking.passengerPhone,
            email: booking.passengerEmail,
            customerNote: booking.customerNote
        },
        journey: {
            pickupPoint: {
                name: booking.pickupPoint_name,
                address: booking.pickupPoint_address,
                time: booking.pickupPoint_time
            },
            dropoffPoint: {
                name: booking.dropoffPoint_name,
                address: booking.dropoffPoint_address,
                time: booking.dropoffPoint_time
            },
            trip: {
                _id: trip._id,
                tripCode: trip.tripCode,
                status: trip.status,
                departureDate: trip.departureDate,
                departureDateDisplay: formatDate(trip.departureDate),
                actualDepartureTime: trip.actualDepartureTime,
                departureTimeDisplay: formatMinutes(trip.actualDepartureTime),
                actualArrivalTime: trip.actualArrivalTime,
                arrivalTimeDisplay: formatMinutes(trip.actualArrivalTime)
            },
            schedule: trip.scheduleId,
            route: trip.routeId,
            bus: trip.busId
        },
        seats: seats.map((seat) => ({
            ...seat,
            priceFormatted: formatVnd(seat.price),
            discountFormatted: formatVnd(seat.discount),
            finalPriceFormatted: formatVnd(seat.finalPrice)
        })),
        payment: {
            status: booking.payment_status,
            total: booking.total,
            totalFormatted: formatVnd(booking.total),
            paidAmount: booking.payment_amount,
            paidAmountFormatted: formatVnd(booking.payment_amount),
            paymentType: booking.payment_paymentType,
            transaction: transaction ? {
                ...transaction,
                amountFormatted: formatVnd(transaction.amount),
                transactionDateDisplay: formatDateTime(transaction.transactionDate)
            } : null
        },
        tickets: tickets.map((ticket) => ({
            ...ticket,
            issuedAtDisplay: formatDateTime(ticket.issuedAt),
            checkedInAtDisplay: formatDateTime(ticket.checkedInAt),
            ticketExpiredAtDisplay: formatDateTime(ticket.ticketExpiredAt)
        })),
        cancellation: {
            reason: booking.cancelReason || null,
            partnerResponse: booking.cancelResponse || null,
            decision: booking.cancellationDecision || null,
            respondedAt: booking.cancellationRespondedAt || null,
            respondedAtDisplay: formatDateTime(booking.cancellationRespondedAt),
            refundAmount: booking.refundAmount || 0,
            refundAmountFormatted: formatVnd(booking.refundAmount),
            refundPolicy: booking.refundPolicy || null,
            cancelledAt: booking.cancelledAt,
            cancelledAtDisplay: formatDateTime(booking.cancelledAt)
        }
    };
};

const respondCancellationRequest = async (partnerId, bookingId, payload) => {
    if (!mongoose.isValidObjectId(bookingId)) {
        throw new AppError('Invalid booking ID', 400);
    }

    const decision = String(payload.decision || '').trim().toUpperCase();
    const response = String(payload.response || '').trim();

    if (!['APPROVE', 'REJECT'].includes(decision)) {
        throw new AppError('Decision must be APPROVE or REJECT', 400);
    }
    if (decision === 'REJECT' && !response) {
        throw new AppError('Rejection reason is required', 400);
    }

    const existingBooking = await Booking.findById(bookingId)
        .select('+cancellationProcessing partnerId status')
        .lean();
    if (!existingBooking) {
        throw new AppError('Booking not found', 404);
    }
    if (String(existingBooking.partnerId) !== String(partnerId)) {
        throw new AppError('You do not have permission to process this booking', 403);
    }
    if (existingBooking.status !== 'CANCEL_REQUESTED') {
        throw new AppError('Booking is not awaiting a cancellation response', 409);
    }

    // Atomic claim prevents two Partner requests from processing the same cancellation.
    const booking = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            partnerId,
            status: 'CANCEL_REQUESTED',
            cancellationProcessing: { $ne: true }
        },
        { $set: { cancellationProcessing: true } },
        { new: true }
    ).select('+cancellationProcessing');

    if (!booking) {
        throw new AppError('Cancellation request is already being processed', 409);
    }

    let modifiedTrip = null;
    let seatSnapshots = [];
    let cancelledTicketIds = [];
    let refundTransactionId = null;

    try {
        if (decision === 'REJECT') {
            booking.status = 'CONFIRMED';
            booking.cancelResponse = response;
            booking.cancellationDecision = 'REJECTED';
            booking.cancellationRespondedAt = new Date();
            booking.cancellationProcessing = false;
            await booking.save();

            const notificationCreated = await notifyCancellationResult(
                booking,
                decision,
                0,
                response
            );

            return {
                bookingId: booking._id,
                bookingCode: booking.bookingCode,
                decision: 'REJECTED',
                status: booking.status,
                paymentStatus: booking.payment_status,
                response,
                assignedSeatsKept: true,
                issuedTicketsKept: true,
                notificationCreated
            };
        }

        const [trip, partnerInformation] = await Promise.all([
            Trip.findOne({ _id: booking.tripId, partnerId }),
            PartnerInformation.findOne({ accountId: partnerId }).select('policies').lean()
        ]);

        if (!trip) {
            throw new AppError('Booking trip information is unavailable', 409);
        }

        const now = new Date();
        const departureAt = getDepartureAt(trip);
        const hoursBeforeDeparture = (departureAt.getTime() - now.getTime()) / (60 * 60 * 1000);
        if (hoursBeforeDeparture <= 0) {
            throw new AppError('Cancellation cannot be approved after the trip has departed', 422);
        }

        const policy = resolveRefundPolicy(partnerInformation?.policies);
        if (hoursBeforeDeparture < policy.minimumHoursBeforeDeparture) {
            throw new AppError(
                `Cancellation must be requested at least ${policy.minimumHoursBeforeDeparture} hours before departure`,
                422
            );
        }

        const paidAmount = Math.min(Number(booking.payment_amount) || 0, Number(booking.total) || 0);
        const refundAmount = Math.round((paidAmount * policy.refundPercentage) / 100);

        const releasedSeatCodes = [];
        trip.seats.forEach((seat) => {
            if (
                String(seat.bookingId || '') === String(booking._id)
                && seat.status === 'BOOKED'
            ) {
                seatSnapshots.push({
                    seatCode: seat.seatCode,
                    status: seat.status,
                    bookingId: seat.bookingId,
                    ticketId: seat.ticketId,
                    holdToken: seat.holdToken,
                    lockedUntil: seat.lockedUntil
                });
                releasedSeatCodes.push(seat.seatCode);
                seat.status = 'AVAILABLE';
                seat.bookingId = null;
                seat.ticketId = null;
                seat.holdToken = null;
                seat.lockedUntil = null;
            }
        });

        if (releasedSeatCodes.length > 0) {
            modifiedTrip = trip;
            trip.availableSeats = Math.min(trip.availableSeats + releasedSeatCodes.length, trip.totalSeats);
            trip.bookedSeats = Math.max(trip.bookedSeats - releasedSeatCodes.length, 0);
            await trip.save();
        }

        const issuedTickets = await Ticket.find({
            bookingId: booking._id,
            tripId: booking.tripId,
            status: 'ISSUED'
        }).select('_id').lean();
        cancelledTicketIds = issuedTickets.map((ticket) => ticket._id);

        const ticketResult = cancelledTicketIds.length > 0
            ? await Ticket.updateMany(
                { _id: { $in: cancelledTicketIds }, status: 'ISSUED' },
                { $set: { status: 'CANCELLED' } }
            )
            : { modifiedCount: 0 };

        let refundTransaction = null;
        if (refundAmount > 0) {
            refundTransaction = await Transaction.create({
                partnerId,
                senderAccountId: booking.customerId,
                bookingId: booking._id,
                transactionType: 'REFUND',
                amount: refundAmount,
                currency: 'VND',
                status: 'SUCCESS',
                gateway: 'PARTNER_MANUAL',
                transactionDate: new Date(),
                referenceCode: payload.refundReference || null,
                description: `Refund for cancelled booking ${booking.bookingCode}`,
                metadata: {
                    direction: 'PARTNER_TO_CUSTOMER',
                    refundPercentage: policy.refundPercentage,
                    cancellationDecision: 'APPROVED'
                }
            });
            refundTransactionId = refundTransaction._id;
        }

        booking.status = 'CANCELLED_BY_CUSTOMER';
        if (refundAmount > 0 && refundTransaction?.status === 'SUCCESS') {
            booking.payment_status = 'REFUNDED';
        }
        booking.cancelResponse = response || 'Cancellation request approved';
        booking.cancellationDecision = 'APPROVED';
        booking.cancellationRespondedAt = new Date();
        booking.cancelledAt = new Date();
        booking.refundAmount = refundAmount;
        booking.refundPolicy = {
            ...policy,
            hoursBeforeDeparture: Number(hoursBeforeDeparture.toFixed(2))
        };
        booking.cancellationProcessing = false;
        await booking.save();

        const notificationCreated = await notifyCancellationResult(
            booking,
            decision,
            refundAmount,
            booking.cancelResponse
        );

        return {
            bookingId: booking._id,
            bookingCode: booking.bookingCode,
            decision: 'APPROVED',
            status: booking.status,
            paymentStatus: booking.payment_status,
            response: booking.cancelResponse,
            refund: {
                amount: refundAmount,
                amountFormatted: formatVnd(refundAmount),
                percentage: policy.refundPercentage,
                transactionId: refundTransaction?._id || null,
                status: refundTransaction?.status || 'NOT_APPLICABLE',
                policy
            },
            releasedSeatCodes,
            cancelledTicketCount: ticketResult.modifiedCount || 0,
            notificationCreated,
            respondedAt: booking.cancellationRespondedAt,
            respondedAtDisplay: formatDateTime(booking.cancellationRespondedAt)
        };
    } catch (error) {
        // Compensating rollback keeps standalone MongoDB consistent when a later write fails.
        if (refundTransactionId) {
            await Transaction.deleteOne({ _id: refundTransactionId }).catch(() => {});
        }
        if (cancelledTicketIds.length > 0) {
            await Ticket.updateMany(
                { _id: { $in: cancelledTicketIds }, status: 'CANCELLED' },
                { $set: { status: 'ISSUED' } }
            ).catch(() => {});
        }
        if (modifiedTrip && seatSnapshots.length > 0) {
            seatSnapshots.forEach((snapshot) => {
                const seat = modifiedTrip.seats.find((item) => item.seatCode === snapshot.seatCode);
                if (seat) {
                    seat.status = snapshot.status;
                    seat.bookingId = snapshot.bookingId;
                    seat.ticketId = snapshot.ticketId;
                    seat.holdToken = snapshot.holdToken;
                    seat.lockedUntil = snapshot.lockedUntil;
                }
            });
            modifiedTrip.availableSeats = Math.max(modifiedTrip.availableSeats - seatSnapshots.length, 0);
            modifiedTrip.bookedSeats = Math.min(
                modifiedTrip.bookedSeats + seatSnapshots.length,
                modifiedTrip.totalSeats
            );
            await modifiedTrip.save().catch(() => {});
        }
        await Booking.updateOne(
            { _id: booking._id, status: 'CANCEL_REQUESTED' },
            { $set: { cancellationProcessing: false } }
        ).catch(() => {});
        throw error;
    }
};

module.exports = {
    getPartnerBookings,
    getPartnerBookingDetail,
    respondCancellationRequest
};
