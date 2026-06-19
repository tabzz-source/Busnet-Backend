const Trip = require('../models/Trip');
const Route = require('../models/Route');
const PartnerInformation = require('../models/PartnerInformation');
const TicketPrice = require('../models/TicketPrice');
const AppError = require('../utils/AppError');

const DEFAULT_TIMEZONE_OFFSET = '+07:00';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const formatMinutesToTime = (minutes) => {
    if (minutes === null || minutes === undefined) return null;

    const totalMinutes = Number(minutes);
    if (Number.isNaN(totalMinutes) || totalMinutes < 0) return null;

    const hours = Math.floor(totalMinutes / 60)
        .toString()
        .padStart(2, '0');
    const mins = (totalMinutes % 60).toString().padStart(2, '0');

    return `${hours}:${mins}`;
};

const parseDepartureDateRange = (departureDate) => {
    if (!departureDate) return null;

    const normalizedDate = String(departureDate).trim();
    const start = new Date(`${normalizedDate}T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);

    if (Number.isNaN(start.getTime())) {
        throw new AppError('Invalid departureDate format. Use YYYY-MM-DD', 400);
    }

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { start, end };
};

const buildRouteFilter = ({ originProvince, destinationProvince }) => {
    const filter = { deletedAt: null };

    const conditions = [];

    if (originProvince) {
        const regex = new RegExp(escapeRegex(String(originProvince).trim()), 'i');
        conditions.push({
            $or: [
                { origin_province: regex },
                { origin_provinceName: regex },
                { origin_district: regex },
                { origin_districtName: regex }
            ]
        });
    }

    if (destinationProvince) {
        const regex = new RegExp(escapeRegex(String(destinationProvince).trim()), 'i');
        conditions.push({
            $or: [
                { destination_province: regex },
                { destination_provinceName: regex },
                { destination_district: regex },
                { destination_districtName: regex }
            ]
        });
    }

    if (conditions.length > 0) {
        filter.$and = conditions;
    }

    return filter;
};

const buildPriceMap = (ticketPrices) => {
    const priceMap = new Map();

    ticketPrices.forEach((price) => {
        const scheduleKey = price.scheduleId.toString();
        if (!priceMap.has(scheduleKey)) {
            priceMap.set(scheduleKey, []);
        }
        priceMap.get(scheduleKey).push(price);
    });

    return priceMap;
};

const pickSeatTypePrice = (prices, departureDate) => {
    if (!prices || prices.length === 0) return null;

    const tripDate = new Date(departureDate);
    const matched = prices
        .filter((price) => {
            const effectiveFrom = new Date(price.effectiveFrom);
            const effectiveTo = price.effectiveTo ? new Date(price.effectiveTo) : null;
            const afterStart = effectiveFrom <= tripDate;
            const beforeEnd = !effectiveTo || effectiveTo >= tripDate;
            return afterStart && beforeEnd;
        })
        .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));

    if (matched.length === 0) return null;

    const best = matched[0];
    return Math.max((best.price || 0) - (best.discount || 0), 0);
};

const formatTrip = ({ trip, partnerInfoMap, seatTypePriceMap }) => {
    const route = trip.routeId || null;
    const schedule = trip.scheduleId || null;
    const bus = trip.busId || null;
    const partnerId = trip.partnerId?.toString?.() || trip.partnerId;
    const partnerInfo = partnerInfoMap.get(partnerId) || null;

    const seatPrices = Array.isArray(trip.seats) ? trip.seats.map((seat) => seat.price).filter((price) => Number.isFinite(price)) : [];
    const seatTypePrices = seatTypePriceMap.get(trip.scheduleId?._id?.toString?.() || trip.scheduleId?.toString?.()) || [];
    const filteredSeatTypePrice = pickSeatTypePrice(seatTypePrices, trip.departureDate);
    const minSeatPrice = seatPrices.length > 0 ? Math.min(...seatPrices) : null;

    const price = filteredSeatTypePrice ?? trip.priceOverride ?? minSeatPrice ?? schedule?.basePrice ?? null;

    return {
        tripId: trip._id,
        tripCode: trip.tripCode,
        partner: partnerInfo
            ? {
                  partnerId,
                  operatorName: partnerInfo.operatorName,
                  ratingAvg: partnerInfo.ratingAvg,
                  totalReviews: partnerInfo.totalReviews,
                  profilePicture: partnerInfo.profilePicture,
                  coverImage: partnerInfo.coverImage,
                  isVerified: partnerInfo.isVerified
              }
            : {
                  partnerId,
                  operatorName: null,
                  ratingAvg: 0,
                  totalReviews: 0,
                  profilePicture: null,
                  coverImage: null,
                  isVerified: false
              },
        route: route
            ? {
                  routeId: route._id,
                  routeName: route.routeName,
                  originProvince: route.origin_provinceName || route.origin_province,
                  originDistrict: route.origin_districtName || route.origin_district || null,
                  destinationProvince: route.destination_provinceName || route.destination_province,
                  destinationDistrict: route.destination_districtName || route.destination_district || null,
                  distanceKm: route.distanceKm,
                  estimatedDuration: route.estimatedDuration
              }
            : null,
        schedule: schedule
            ? {
                  scheduleId: schedule._id,
                  scheduleCode: schedule.scheduleCode,
                  departureTime: schedule.departureTime,
                  arrivalTime: schedule.arrivalTime,
                  recurrenceType: schedule.recurrenceType
              }
            : null,
        bus: bus
            ? {
                  busId: bus._id,
                  busName: bus.busName,
                  busType: bus.busType,
                  totalSeats: bus.totalSeats,
                  licensePlate: bus.licensePlate,
                  images: bus.images || []
              }
            : null,
        departureDate: trip.departureDate,
        departureTime: formatMinutesToTime(trip.actualDepartureTime),
        arrivalTime: formatMinutesToTime(trip.actualArrivalTime),
        totalSeats: trip.totalSeats,
        availableSeats: trip.availableSeats,
        bookedSeats: trip.bookedSeats,
        heldSeats: trip.heldSeats,
        status: trip.status,
        price,
        minPrice: price,
        seats: trip.seats || []
    };
};

const searchTrips = async (queryParams = {}) => {
    const {
        originProvince,
        destinationProvince,
        departureDate,
        seatType,
        page = 1,
        limit = 10
    } = queryParams;

    const hasRouteCriteria = Boolean(originProvince || destinationProvince);
    const routeFilter = buildRouteFilter({ originProvince, destinationProvince });
    const routeIds = hasRouteCriteria ? await Route.find(routeFilter).select('_id').lean() : [];

    if (hasRouteCriteria && routeIds.length === 0) {
        return {
            trips: [],
            pagination: {
                totalItems: 0,
                totalPages: 0,
                currentPage: Number(page) || 1,
                limit: Number(limit) || 10
            }
        };
    }

    const tripFilter = {
        status: 'OPEN'
    };

    if (routeIds.length > 0) {
        tripFilter.routeId = { $in: routeIds.map((route) => route._id) };
    }

    const dateRange = parseDepartureDateRange(departureDate);
    if (dateRange) {
        tripFilter.departureDate = {
            $gte: dateRange.start,
            $lt: dateRange.end
        };
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
    const skip = (pageNum - 1) * limitNum;

    if (seatType) {
        const priceFilter = {
            seatType: String(seatType).trim(),
            isActive: true
        };

        if (dateRange) {
            priceFilter.effectiveFrom = { $lte: dateRange.start };
            priceFilter.$or = [
                { effectiveTo: null },
                { effectiveTo: { $gte: dateRange.start } }
            ];
        }

        const scheduleIds = await TicketPrice.distinct('scheduleId', priceFilter);

        if (scheduleIds.length === 0) {
            return {
                trips: [],
                pagination: {
                    totalItems: 0,
                    totalPages: 0,
                    currentPage: pageNum,
                    limit: limitNum
                }
            };
        }

        tripFilter.scheduleId = { $in: scheduleIds };
    }

    const [trips, totalItems] = await Promise.all([
        Trip.find(tripFilter)
            .populate('routeId', 'routeName origin_province origin_provinceName origin_district origin_districtName destination_province destination_provinceName destination_district destination_districtName distanceKm estimatedDuration')
            .populate('scheduleId', 'scheduleCode basePrice departureTime arrivalTime recurrenceType')
            .populate('busId', 'busName licensePlate busType totalSeats images amenities status isActive')
            .sort({ departureDate: 1, actualDepartureTime: 1, createdAt: 1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Trip.countDocuments(tripFilter)
    ]);

    const partnerIds = [
        ...new Set(
            trips
                .map((trip) => trip.partnerId?.toString?.() || String(trip.partnerId))
                .filter(Boolean)
        )
    ];
    const partnerInfos = await PartnerInformation.find({ accountId: { $in: partnerIds } })
        .select('accountId operatorName profilePicture coverImage ratingAvg totalReviews isVerified')
        .lean();
    const partnerInfoMap = new Map(partnerInfos.map((info) => [info.accountId.toString(), info]));

    let seatTypePriceMap = new Map();
    if (seatType && trips.length > 0) {
        const scheduleIdList = trips.map((trip) => trip.scheduleId?._id?.toString?.() || trip.scheduleId?.toString?.()).filter(Boolean);
        const ticketPrices = await TicketPrice.find({
            scheduleId: { $in: scheduleIdList },
            seatType: String(seatType).trim(),
            isActive: true
        })
            .select('scheduleId price discount effectiveFrom effectiveTo')
            .lean();
        seatTypePriceMap = buildPriceMap(ticketPrices);
    }

    const tripItems = trips.map((trip) => formatTrip({ trip, partnerInfoMap, seatTypePriceMap }));

    return {
        trips: tripItems,
        pagination: {
            totalItems,
            totalPages: Math.ceil(totalItems / limitNum),
            currentPage: pageNum,
            limit: limitNum
        }
    };
};

const getTripDetail = async (tripId) => {
    const trip = await Trip.findById(tripId)
        .populate('routeId', 'routeName origin_province origin_provinceName origin_district origin_districtName destination_province destination_provinceName destination_district destination_districtName distanceKm estimatedDuration')
        .populate('scheduleId', 'scheduleCode basePrice departureTime arrivalTime recurrenceType')
        .populate('busId', 'busName licensePlate busType totalSeats images amenities status isActive')
        .lean();

    if (!trip) {
        throw new AppError('Trip not found', 404);
    }

    const partnerInfo = await PartnerInformation.findOne({ accountId: trip.partnerId })
        .select('accountId operatorName profilePicture coverImage ratingAvg totalReviews isVerified')
        .lean();
    const partnerInfoMap = new Map([[trip.partnerId.toString(), partnerInfo]]);

    return formatTrip({ trip, partnerInfoMap, seatTypePriceMap: new Map() });
};

const getTripSeats = async (tripId) => {
    const trip = await Trip.findById(tripId).select('_id tripCode seats').lean();

    if (!trip) {
        throw new AppError('Trip not found', 404);
    }

    return {
        tripId: trip._id,
        tripCode: trip.tripCode,
        seats: trip.seats || []
    };
};

const getTripById = async (tripId, session = null) => {
    const query = Trip.findById(tripId)
        .populate('routeId', 'routeName origin_province origin_provinceName origin_district origin_districtName destination_province destination_provinceName destination_district destination_districtName distanceKm estimatedDuration')
        .populate('scheduleId', 'scheduleCode basePrice departureTime arrivalTime recurrenceType')
        .populate('busId', 'busName licensePlate busType totalSeats images amenities status isActive');

    if (session) {
        query.session(session);
    }

    return query.lean();
};

const getSelectedSeatSnapshots = (trip, seatCodes) => {
    const seatCodeSet = new Set(seatCodes);
    const selectedSeats = trip.seats.filter((seat) => seatCodeSet.has(seat.seatCode));

    if (selectedSeats.length !== seatCodes.length) {
        throw new AppError('One or more seats were not found on this trip', 404);
    }

    const invalidSeat = selectedSeats.find((seat) => seat.status !== 'AVAILABLE');
    if (invalidSeat) {
        throw new AppError(`Seat ${invalidSeat.seatCode} is not available`, 409);
    }

    return selectedSeats;
};

const holdTripSeats = async ({ tripId, seatCodes, holdToken, lockedUntil, session = null }) => {
    const uniqueSeatCodes = [...new Set(seatCodes.map((seatCode) => String(seatCode).trim()).filter(Boolean))];

    if (uniqueSeatCodes.length === 0) {
        throw new AppError('seatCodes is required', 400);
    }

    const trip = await getTripById(tripId, session);
    if (!trip) {
        throw new AppError('Trip not found', 404);
    }

    if (trip.status !== 'OPEN') {
        throw new AppError('Trip is not open for booking', 409);
    }

    const selectedSeats = getSelectedSeatSnapshots(trip, uniqueSeatCodes);

    const updated = await Trip.updateOne(
        {
            _id: trip._id,
            status: 'OPEN',
            availableSeats: { $gte: uniqueSeatCodes.length },
            seats: { $not: { $elemMatch: { seatCode: { $in: uniqueSeatCodes }, status: { $ne: 'AVAILABLE' } } } },
            'seats.seatCode': { $all: uniqueSeatCodes }
        },
        {
            $set: {
                'seats.$[seat].status': 'HELD',
                'seats.$[seat].holdToken': holdToken,
                'seats.$[seat].lockedUntil': lockedUntil
            },
            $inc: {
                availableSeats: -uniqueSeatCodes.length,
                heldSeats: uniqueSeatCodes.length
            }
        },
        {
            arrayFilters: [
                {
                    'seat.seatCode': { $in: uniqueSeatCodes },
                    'seat.status': 'AVAILABLE'
                }
            ],
            session
        }
    );

    if (updated.modifiedCount !== 1) {
        throw new AppError('Failed to hold selected seats. Please try again.', 409);
    }

    return {
        tripId: trip._id,
        tripCode: trip.tripCode,
        holdToken,
        lockedUntil,
        seats: selectedSeats,
        trip
    };
};

const attachBookingIdToHeldSeats = async ({ tripId, bookingId, holdToken, seatCodes, session = null }) => {
    const uniqueSeatCodes = [...new Set(seatCodes.map((seatCode) => String(seatCode).trim()).filter(Boolean))];

    const update = await Trip.updateOne(
        {
            _id: tripId,
            'seats.seatCode': { $all: uniqueSeatCodes }
        },
        {
            $set: {
                'seats.$[seat].bookingId': bookingId
            }
        },
        {
            arrayFilters: [
                {
                    'seat.seatCode': { $in: uniqueSeatCodes },
                    'seat.holdToken': holdToken,
                    'seat.status': 'HELD'
                }
            ],
            session
        }
    );

    if (update.modifiedCount !== 1) {
        throw new AppError('Failed to attach booking to held seats', 500);
    }

    return true;
};

const releaseSeatsByHoldToken = async ({ tripId, holdToken, session = null }) => {
    const query = Trip.findOne({ _id: tripId, 'seats.holdToken': holdToken });
    if (session) {
        query.session(session);
    }
    const trip = await query.lean();

    if (!trip) {
        return { releasedSeats: 0 };
    }

    const seatsToRelease = trip.seats.filter((seat) => seat.holdToken === holdToken && seat.status === 'HELD');

    if (seatsToRelease.length === 0) {
        return { releasedSeats: 0 };
    }

    const released = await Trip.updateOne(
        {
            _id: tripId,
            'seats.holdToken': holdToken
        },
        {
            $set: {
                'seats.$[seat].status': 'AVAILABLE',
                'seats.$[seat].bookingId': null,
                'seats.$[seat].holdToken': null,
                'seats.$[seat].lockedUntil': null
            },
            $inc: {
                availableSeats: seatsToRelease.length,
                heldSeats: -seatsToRelease.length
            }
        },
        {
            arrayFilters: [
                {
                    'seat.holdToken': holdToken,
                    'seat.status': 'HELD'
                }
            ],
            session
        }
    );

    return {
        releasedSeats: released.modifiedCount === 1 ? seatsToRelease.length : 0
    };
};

module.exports = {
    searchTrips,
    getTripDetail,
    getTripSeats,
    holdTripSeats,
    attachBookingIdToHeldSeats,
    releaseSeatsByHoldToken
};
