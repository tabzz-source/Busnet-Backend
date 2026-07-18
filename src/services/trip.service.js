const Trip = require('../models/Trip');
const Route = require('../models/Route');
const Schedule = require('../models/Schedule');
const PartnerInformation = require('../models/PartnerInformation');
const Bus = require('../models/Bus');
const AppError = require('../utils/AppError');

/**
 * Helper to convert time string (HH:MM) to minutes from midnight
 * @param {string} timeStr - "07:30"
 * @returns {number} 450
 */
const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

// Calendar-day-only comparison — strips time-of-day so a Schedule's
// startDate/endDate/exceptionDates/customDates (stored as UTC midnight from
// "YYYY-MM-DD" form inputs) compare correctly against targetDate (already
// normalized to local midnight by the caller, matching how startOfDay/
// endOfDay are built elsewhere in this file).
const dateOnly = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const sameDate = (a, b) => dateOnly(a).getTime() === dateOnly(b).getTime();

/**
 * Whether a Schedule actually runs on targetDate, given its recurrence rule.
 * Previously trip generation ignored recurrenceType/recurrenceRule entirely
 * and spawned a trip for every active schedule on every queried date — this
 * is what schedules its occurrence for real:
 *   - startDate/endDate always bound the window, regardless of frequency.
 *   - exceptionDates always skip that day even if the frequency would
 *     otherwise match (e.g. a holiday exception on an otherwise-daily route).
 *   - NONE/ONCE occurs only on startDate itself.
 *   - CUSTOM occurs only on dates listed in customDates.
 *   - WEEKLY occurs on days whose Date.getDay() (0=Sun..6=Sat) is in
 *     daysOfWeek; falls back to startDate's own weekday if daysOfWeek is
 *     empty (defensive default for older data saved before the picker UI
 *     existed).
 *   - MONTHLY occurs on days whose Date.getDate() (1-31) is in daysOfMonth;
 *     same fallback to startDate's day-of-month if empty.
 *   - DAILY occurs every day in the window, honoring recurrenceRule.interval
 *     (every N days from startDate) when set above 1.
 */
const scheduleOccursOnDate = (schedule, targetDate) => {
    const rule = schedule.recurrenceRule || {};
    const target = dateOnly(targetDate);

    if (rule.startDate && target < dateOnly(rule.startDate)) return false;
    if (rule.endDate && target > dateOnly(rule.endDate)) return false;

    const exceptionDates = schedule.exceptionDates || [];
    if (exceptionDates.some((d) => sameDate(d, target))) return false;

    const frequency = rule.frequency || schedule.recurrenceType || 'DAILY';

    if (frequency === 'NONE' || schedule.recurrenceType === 'ONCE') {
        return !!rule.startDate && sameDate(rule.startDate, target);
    }

    if (frequency === 'CUSTOM') {
        const customDates = schedule.customDates || [];
        return customDates.some((d) => sameDate(d, target));
    }

    if (frequency === 'WEEKLY') {
        const daysOfWeek = rule.daysOfWeek && rule.daysOfWeek.length > 0
            ? rule.daysOfWeek
            : (rule.startDate ? [dateOnly(rule.startDate).getDay()] : []);
        return daysOfWeek.includes(target.getDay());
    }

    if (frequency === 'MONTHLY') {
        const daysOfMonth = rule.daysOfMonth && rule.daysOfMonth.length > 0
            ? rule.daysOfMonth
            : (rule.startDate ? [dateOnly(rule.startDate).getDate()] : []);
        return daysOfMonth.includes(target.getDate());
    }

    // DAILY (default)
    const interval = rule.interval && rule.interval > 1 ? rule.interval : 1;
    if (interval > 1 && rule.startDate) {
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysSinceStart = Math.round((target.getTime() - dateOnly(rule.startDate).getTime()) / msPerDay);
        return daysSinceStart >= 0 && daysSinceStart % interval === 0;
    }
    return true;
};

/**
 * Search and retrieve customer trips with dynamic generation, filtering, sorting, and pagination.
 */
const searchTrips = async (queryParams) => {
    const {
        from,
        to,
        date,
        departureTimes, // Array of strings or single string: earlyMorning, morning, afternoon, evening
        operators,      // Array or single string of partner/operator account IDs
        busTypes,       // Array or single string of bus types (Sleeper, Limousine, Seater, Cabin)
        minPrice,
        maxPrice,
        sortBy = 'cheapest', // cheapest, earliest, latest, rating
        page = 1,
        limit = 10
    } = queryParams;

    // Default search parameters if not provided
    let targetDateStr = date;
    if (!targetDateStr) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        targetDateStr = `${year}-${month}-${day}`;
    }

    // 1. Resolve matching routes dynamically based on provided search keywords
    const routeQuery = {
        isActive: true,
        deletedAt: null
    };

    const andConditions = [];

    if (from) {
        andConditions.push({
            $or: [
                { origin_provinceName: { $regex: from, $options: 'i' } },
                { origin_districtName: { $regex: from, $options: 'i' } }
            ]
        });
    }

    if (to) {
        andConditions.push({
            $or: [
                { destination_provinceName: { $regex: to, $options: 'i' } },
                { destination_districtName: { $regex: to, $options: 'i' } }
            ]
        });
    }

    if (andConditions.length > 0) {
        routeQuery.$and = andConditions;
    }

    const matchingRoutes = await Route.find(routeQuery);
    if (matchingRoutes.length === 0) {
        return { trips: [], pagination: { totalResults: 0, page: Number(page), limit: Number(limit), totalPages: 0 } };
    }

    const matchingRouteIds = matchingRoutes.map(r => r._id);

    // Get time boundaries for the date (local time bounds)
    const targetDate = new Date(targetDateStr);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 2. Scan active schedules on matching routes
    const activeSchedules = await Schedule.find({
        routeId: { $in: matchingRouteIds },
        isActive: true
    }).populate('busId');

    // 3. Find existing trips for the date
    const existingTrips = await Trip.find({
        scheduleId: { $in: activeSchedules.map(s => s._id) },
        departureDate: { $gte: startOfDay, $lte: endOfDay }
    });

    const existingScheduleIds = new Set(existingTrips.map(t => t.scheduleId.toString()));

    // 4. Dynamically generate trips for schedules that don't have one yet and
    // actually run on this date per their recurrence rule
    const tripsToCreate = [];
    for (const schedule of activeSchedules) {
        if (!existingScheduleIds.has(schedule._id.toString()) && scheduleOccursOnDate(schedule, startOfDay)) {
            // Generate seat layouts dynamically based on bus dimensions
            const seats = [];
            const bus = schedule.busId;
            const floors = bus.seatLayout_totalFloors || 1;
            const rows = bus.seatLayout_totalRows || 5;
            const cols = bus.seatLayout_totalColumns || 4;

            for (let f = 1; f <= floors; f++) {
                const floorPrefix = floors > 1 ? (f === 1 ? 'A' : 'B') : 'A';
                for (let r = 1; r <= rows; r++) {
                    for (let c = 1; c <= cols; c++) {
                        const colLetter = String.fromCharCode(65 + c - 1); // A, B, C...
                        const seatCode = `${floorPrefix}${r}${colLetter}`;
                        seats.push({
                            seatCode,
                            price: schedule.basePrice,
                            status: 'AVAILABLE'
                        });
                    }
                }
            }

            const depMinutes = timeToMinutes(schedule.departureTime);
            const arrMinutes = timeToMinutes(schedule.arrivalTime);

            const tripCode = `TRIP-${schedule.scheduleCode}-${targetDateStr.replace(/-/g, '')}`;

            tripsToCreate.push({
                scheduleId: schedule._id,
                partnerId: schedule.partnerId,
                routeId: schedule.routeId,
                busId: bus._id,
                tripCode,
                departureDate: startOfDay,
                actualDepartureTime: depMinutes,
                actualArrivalTime: arrMinutes,
                arrivalDayOffset: schedule.arrivalDayOffset || 0,
                totalSeats: seats.length,
                availableSeats: seats.length,
                seats,
                status: 'OPEN'
            });
        }
    }

    if (tripsToCreate.length > 0) {
        try {
            await Trip.insertMany(tripsToCreate, { ordered: false });
        } catch (err) {
            // Ignore duplicate key errors in case of concurrent writes
            console.log('Some trips were already created concurrently, proceeding...');
        }
    }

    // 5. Fetch all trips for the route and date
    let trips = await Trip.find({
        routeId: { $in: matchingRouteIds },
        departureDate: { $gte: startOfDay, $lte: endOfDay },
        status: { $ne: 'CANCELLED' }
    })
    .populate('routeId')
    .populate('busId');

    // 6. Parse and Apply Filters in JS memory
    // Filter by departure time range
    if (departureTimes) {
        const slots = Array.isArray(departureTimes) ? departureTimes : [departureTimes];
        if (slots.length > 0) {
            trips = trips.filter(trip => {
                const time = trip.actualDepartureTime; // in minutes
                return slots.some(slot => {
                    if (slot === 'earlyMorning') return time < 360;             // < 06:00
                    if (slot === 'morning') return time >= 360 && time < 720;     // 06:00 - 12:00
                    if (slot === 'afternoon') return time >= 720 && time < 1080;  // 12:00 - 18:00
                    if (slot === 'evening') return time >= 1080 && time < 1440;   // 18:00 - 24:00
                    return false;
                });
            });
        }
    }

    // Filter by operators
    if (operators) {
        const ops = Array.isArray(operators) ? operators : [operators];
        if (ops.length > 0) {
            trips = trips.filter(trip => ops.includes(trip.partnerId.toString()));
        }
    }

    // Filter by bus types
    if (busTypes) {
        const types = Array.isArray(busTypes) ? busTypes : [busTypes];
        if (types.length > 0) {
            trips = trips.filter(trip => trip.busId && types.includes(trip.busId.busType));
        }
    }

    // Filter by price range
    if (minPrice || maxPrice) {
        const min = minPrice ? Number(minPrice) : 0;
        const max = maxPrice ? Number(maxPrice) : Infinity;
        trips = trips.filter(trip => {
            const price = trip.seats && trip.seats.length > 0 ? trip.seats[0].price : 0;
            return price >= min && price <= max;
        });
    }

    // 7. Get Operator profile details
    const partnerIds = [...new Set(trips.map(t => t.partnerId.toString()))];
    const partnerInfos = await PartnerInformation.find({ accountId: { $in: partnerIds } });
    const partnerInfoMap = {};
    partnerInfos.forEach(p => {
        partnerInfoMap[p.accountId.toString()] = p;
    });

    // 8. Map to clean output response structure
    let formattedTrips = trips.map(trip => {
        const partnerInfo = partnerInfoMap[trip.partnerId.toString()];
        const price = trip.seats && trip.seats.length > 0 ? trip.seats[0].price : 0;
        return {
            _id: trip._id,
            tripCode: trip.tripCode,
            departureDate: trip.departureDate,
            actualDepartureTime: trip.actualDepartureTime,
            actualArrivalTime: trip.actualArrivalTime,
            arrivalDayOffset: trip.arrivalDayOffset || 0,
            totalSeats: trip.totalSeats,
            availableSeats: trip.availableSeats,
            status: trip.status,
            route: trip.routeId,
            bus: trip.busId,
            price,
            operator: partnerInfo ? {
                _id: partnerInfo.accountId,
                operatorName: partnerInfo.operatorName,
                operatorPhone: partnerInfo.operatorPhone,
                description: partnerInfo.description,
                ratingAvg: partnerInfo.ratingAvg,
                totalReviews: partnerInfo.totalReviews,
                isVerified: partnerInfo.isVerified,
                profilePicture: partnerInfo.profilePicture || null,
                coverImage: partnerInfo.coverImage || null,
                amenities: partnerInfo.amenities
            } : null
        };
    });

    // 9. Apply Sorting
    if (sortBy === 'cheapest') {
        formattedTrips.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'earliest') {
        formattedTrips.sort((a, b) => a.actualDepartureTime - b.actualDepartureTime);
    } else if (sortBy === 'latest') {
        formattedTrips.sort((a, b) => b.actualDepartureTime - a.actualDepartureTime);
    } else if (sortBy === 'rating') {
        formattedTrips.sort((a, b) => {
            const ratingA = a.operator ? a.operator.ratingAvg : 0;
            const ratingB = b.operator ? b.operator.ratingAvg : 0;
            return ratingB - ratingA;
        });
    }

    // 10. Paginate
    const totalResults = formattedTrips.length;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = pageNum * limitNum;
    const paginatedTrips = formattedTrips.slice(startIndex, endIndex);

    return {
        trips: paginatedTrips,
        pagination: {
            totalResults,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(totalResults / limitNum)
        }
    };
};

/**
 * Get list of unique origin and destination provinces from active routes
 */
const getLocations = async () => {
    const origins = await Route.distinct('origin_provinceName', { isActive: true, deletedAt: null });
    const destinations = await Route.distinct('destination_provinceName', { isActive: true, deletedAt: null });
    return {
        origins: origins.filter(Boolean).sort(),
        destinations: destinations.filter(Boolean).sort()
    };
};

const getTripDetail = async (tripId) => {
    const trip = await Trip.findById(tripId)
        .populate({
            path: 'routeId',
            select: 'routeName origin_provinceName origin_districtName origin_representativeAddress destination_provinceName destination_districtName destination_representativeAddress distanceKm estimatedDuration'
        })
        .populate({
            path: 'scheduleId',
            select: 'scheduleCode departureTime arrivalTime recurrenceType recurrenceRule customDates exceptionDates operationNotes'
        })
        .populate({
            path: 'busId',
            select: 'busName licensePlate busType totalSeats description images amenities seatLayout_totalRows seatLayout_totalColumns seatLayout_totalFloors'
        })
        .populate({
            path: 'partnerId',
            select: 'fullName email phone profilePicture'
        })
        .lean();

    if (!trip) {
        throw new AppError('Trip not found', 404);
    }

    const partnerInfo = await PartnerInformation.findOne({
        accountId: trip.partnerId?._id || trip.partnerId
    }).lean();

    return {
        trip: {
            _id: trip._id,
            tripCode: trip.tripCode,
            departureDate: trip.departureDate,
            actualDepartureTime: trip.actualDepartureTime,
            actualArrivalTime: trip.actualArrivalTime,
            arrivalDayOffset: trip.arrivalDayOffset || 0,
            totalSeats: trip.totalSeats,
            availableSeats: trip.availableSeats,
            bookedSeats: trip.bookedSeats,
            heldSeats: trip.heldSeats,
            priceOverride: trip.priceOverride,
            status: trip.status,
            route: trip.routeId,
            schedule: trip.scheduleId,
            bus: trip.busId,
            operator: partnerInfo ? {
                _id: partnerInfo.accountId,
                operatorName: partnerInfo.operatorName,
                operatorPhone: partnerInfo.operatorPhone,
                description: partnerInfo.description,
                amenities: partnerInfo.amenities,
                ratingAvg: partnerInfo.ratingAvg,
                totalReviews: partnerInfo.totalReviews,
                isVerified: partnerInfo.isVerified,
                profilePicture: partnerInfo.profilePicture || null,
                coverImage: partnerInfo.coverImage || null
            } : null,
            seats: Array.isArray(trip.seats)
                ? trip.seats.map((seat) => ({
                    seatCode: seat.seatCode,
                    price: seat.price,
                    seatType: seat.seatType,
                    status: seat.status
                }))
                : []
        }
    };
};

const getTripBookingOptions = async (tripId) => {
    const trip = await Trip.findById(tripId)
        .populate({
            path: 'routeId',
            select: 'routeName origin_provinceName origin_districtName origin_representativeAddress destination_provinceName destination_districtName destination_representativeAddress distanceKm estimatedDuration'
        })
        .populate({
            path: 'scheduleId',
            select: 'scheduleCode departureTime arrivalTime recurrenceType recurrenceRule customDates exceptionDates operationNotes'
        })
        .populate({
            path: 'busId',
            select: 'busName licensePlate busType totalSeats description images amenities seatLayout_totalRows seatLayout_totalColumns seatLayout_totalFloors'
        })
        .lean();

    if (!trip) {
        throw new AppError('Trip not found', 404);
    }

    const [pickupPoints, dropoffPoints] = await Promise.all([
        require('../models/SchedulePickupPoint')
            .find({ scheduleId: trip.scheduleId._id || trip.scheduleId })
            .sort({ orderIndex: 1 })
            .lean(),
        require('../models/ScheduleDropoffPoint')
            .find({ scheduleId: trip.scheduleId._id || trip.scheduleId })
            .sort({ orderIndex: 1 })
            .lean()
    ]);

    return {
        trip: {
            _id: trip._id,
            tripCode: trip.tripCode,
            departureDate: trip.departureDate,
            actualDepartureTime: trip.actualDepartureTime,
            actualArrivalTime: trip.actualArrivalTime,
            arrivalDayOffset: trip.arrivalDayOffset || 0,
            totalSeats: trip.totalSeats,
            availableSeats: trip.availableSeats,
            bookedSeats: trip.bookedSeats,
            heldSeats: trip.heldSeats,
            priceOverride: trip.priceOverride,
            status: trip.status,
            route: trip.routeId,
            schedule: trip.scheduleId,
            bus: trip.busId,
            seats: Array.isArray(trip.seats)
                ? trip.seats.map((seat) => ({
                    seatCode: seat.seatCode,
                    price: seat.price,
                    seatType: seat.seatType,
                    status: seat.status
                }))
                : []
        },
        pickupPoints,
        dropoffPoints
    };
};

module.exports = {
    searchTrips,
    getLocations,
    getTripDetail,
    getTripBookingOptions
};
