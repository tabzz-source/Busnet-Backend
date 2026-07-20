const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Trip = require('../models/Trip');
const Bus = require('../models/Bus');
const AppError = require('../utils/AppError');

const TICKET_STATUSES = ['ISSUED', 'CANCELLED', 'EXPIRED', 'USED', 'NO_SHOW'];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseBoolean = (value, fieldName) => {
    if (value === undefined) return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    throw new AppError(`${fieldName} must be true or false`, 400);
};

const parseDate = (value, fieldName, endOfDay = false) => {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new AppError(`${fieldName} must be a valid date`, 400);
    }

    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        date.setUTCHours(23, 59, 59, 999);
    }

    return date;
};

const getPartnerTickets = async (partnerId, query = {}) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const partnerObjectId = new mongoose.Types.ObjectId(partnerId);
    const ticketMatch = {};

    if (query.status) {
        const status = String(query.status).toUpperCase();
        if (!TICKET_STATUSES.includes(status)) {
            throw new AppError(`status must be one of: ${TICKET_STATUSES.join(', ')}`, 400);
        }
        ticketMatch.status = status;
    }

    const checkInStatus = parseBoolean(query.checkInStatus, 'checkInStatus');
    if (checkInStatus !== undefined) ticketMatch.checkInStatus = checkInStatus;

    if (query.tripId) {
        if (!mongoose.isValidObjectId(query.tripId)) {
            throw new AppError('Invalid trip ID', 400);
        }
        ticketMatch.tripId = new mongoose.Types.ObjectId(query.tripId);
    }

    let busObjectId = null;
    if (query.busId) {
        if (!mongoose.isValidObjectId(query.busId)) {
            throw new AppError('Invalid bus ID', 400);
        }
        busObjectId = new mongoose.Types.ObjectId(query.busId);
    }

    const departureFrom = parseDate(query.departureFrom, 'departureFrom');
    const departureTo = parseDate(query.departureTo, 'departureTo', true);
    if (departureFrom && departureTo && departureFrom > departureTo) {
        throw new AppError('departureFrom must be earlier than departureTo', 400);
    }

    const pipeline = [
        { $match: ticketMatch },
        {
            $lookup: {
                from: 'bookings',
                localField: 'bookingId',
                foreignField: '_id',
                as: 'booking'
            }
        },
        { $unwind: '$booking' },
        { $match: { 'booking.partnerId': partnerObjectId } },
        {
            $lookup: {
                from: 'trips',
                localField: 'tripId',
                foreignField: '_id',
                as: 'trip'
            }
        },
        { $unwind: '$trip' },
        {
            $match: {
                'trip.partnerId': partnerObjectId,
                $expr: { $eq: ['$booking.tripId', '$trip._id'] }
            }
        },
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
        { $unwind: { path: '$bus', preserveNullAndEmptyArrays: true } }
    ];

    if (busObjectId) {
        pipeline.push({ $match: { 'trip.busId': busObjectId } });
    }

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
                    { ticketCode: pattern },
                    { seatCode: pattern },
                    { 'booking.bookingCode': pattern },
                    { 'booking.passengerName': pattern },
                    { 'booking.passengerPhone': pattern },
                    { 'trip.tripCode': pattern }
                ]
            }
        });
    }

    pipeline.push({
        $facet: {
            tickets: [
                { $sort: { issuedAt: -1, _id: -1 } },
                { $skip: skip },
                { $limit: limit },
                {
                    $project: {
                        _id: 1,
                        ticketCode: 1,
                        seatCode: 1,
                        status: 1,
                        checkInStatus: 1,
                        checkedInAt: 1,
                        ticketExpiredAt: 1,
                        issuedAt: 1,
                        booking: {
                            _id: '$booking._id',
                            bookingCode: '$booking.bookingCode',
                            passengerName: '$booking.passengerName',
                            passengerPhone: '$booking.passengerPhone',
                            passengerEmail: '$booking.passengerEmail',
                            status: '$booking.status',
                            paymentStatus: '$booking.payment_status',
                            total: '$booking.total'
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

    const [aggregationResult, busIds] = await Promise.all([
        Ticket.aggregate(pipeline),
        Trip.distinct('busId', { partnerId: partnerObjectId })
    ]);
    const [result] = aggregationResult;
    const buses = await Bus.find({ _id: { $in: busIds } })
        .select('busName licensePlate busType')
        .sort({ busName: 1, licensePlate: 1 })
        .lean();
    const total = result.metadata[0]?.total || 0;

    return {
        tickets: result.tickets,
        filterOptions: { buses },
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

const getPartnerTicketDetail = async (partnerId, ticketId) => {
    if (!mongoose.isValidObjectId(ticketId)) {
        throw new AppError('Invalid ticket ID', 400);
    }

    const ticket = await Ticket.findById(ticketId)
        .populate({
            path: 'bookingId',
            match: { partnerId },
            select: 'bookingCode customerId tripId passengerName passengerPhone passengerEmail pickupPoint_name pickupPoint_address pickupPoint_time dropoffPoint_name dropoffPoint_address dropoffPoint_time total status payment_status payment_amount payment_paymentType confirmedAt createdAt'
        })
        .populate({
            path: 'tripId',
            match: { partnerId },
            select: 'scheduleId routeId busId tripCode departureDate actualDepartureTime actualArrivalTime status',
            populate: [
                {
                    path: 'scheduleId',
                    select: 'scheduleCode departureTime arrivalTime recurrenceType'
                },
                {
                    path: 'routeId',
                    select: 'routeName origin_provinceName origin_districtName origin_representativeAddress destination_provinceName destination_districtName destination_representativeAddress distanceKm estimatedDuration'
                },
                {
                    path: 'busId',
                    select: 'busName licensePlate busType totalSeats amenities'
                }
            ]
        })
        .lean();

    if (!ticket || !ticket.bookingId || !ticket.tripId) {
        throw new AppError('Ticket not found or does not belong to your account', 404);
    }

    if (String(ticket.bookingId.tripId) !== String(ticket.tripId._id)) {
        throw new AppError('Ticket data is inconsistent', 409);
    }

    const { bookingId, tripId, ...ticketData } = ticket;

    return {
        ticket: ticketData,
        booking: bookingId,
        trip: {
            _id: tripId._id,
            tripCode: tripId.tripCode,
            departureDate: tripId.departureDate,
            actualDepartureTime: tripId.actualDepartureTime,
            actualArrivalTime: tripId.actualArrivalTime,
            status: tripId.status
        },
        schedule: tripId.scheduleId,
        route: tripId.routeId,
        bus: tripId.busId
    };
};

module.exports = { getPartnerTickets, getPartnerTicketDetail };
