const Schedule = require('../models/Schedule');
const SchedulePickupPoint = require('../models/SchedulePickupPoint');
const ScheduleDropoffPoint = require('../models/ScheduleDropoffPoint');
const Route = require('../models/Route');
const Bus = require('../models/Bus');
const Trip = require('../models/Trip');
const AppError = require('../utils/AppError');

const generateScheduleCode = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SCH-${timestamp}-${random}`;
};

const timeToMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

// Mirrors the endDate>startDate check the validators run on raw request
// bodies — but update requests can change just one of the two fields, so the
// validator alone can't see the *effective* pair. Re-check here against the
// fully-resolved (existing + incoming) values.
const assertValidDateRange = (startDate, endDate) => {
    if (endDate && new Date(endDate) <= new Date(startDate)) {
        throw new AppError('End date must be after start date', 400);
    }
};

// A schedule is either same-day (arrivalDayOffset 0 — arrivalTime must be
// strictly after departureTime) or multi-day (arrivalDayOffset >= 1 — arrives
// N calendar days after departureDate, e.g. depart 22:00 day 0, arrive 06:00
// day 1 for an overnight route, or day 2+ for a long-haul route), in which
// case arrivalTime can be numerically anything relative to departureTime
// since they're on different calendar days.
const assertValidTimeRange = (departureTime, arrivalTime, arrivalDayOffset) => {
    if (!arrivalDayOffset && timeToMinutes(arrivalTime) <= timeToMinutes(departureTime)) {
        throw new AppError('Arrival time must be after departure time (or set the number of days the route spans)', 400);
    }
};

// Trip generation (trip.service.js's scheduleOccursOnDate) reads daysOfWeek/
// daysOfMonth to decide which calendar days a WEEKLY/MONTHLY schedule
// actually runs on — an empty array there would fall back to just startDate's
// own weekday/day-of-month, which is almost certainly not what "Weekly" or
// "Monthly" was meant to convey when the partner picked it, so require an
// explicit selection instead of silently guessing.
const assertRecurrenceDaysSelected = (frequency, daysOfWeek, daysOfMonth) => {
    if (frequency === 'WEEKLY' && (!daysOfWeek || daysOfWeek.length === 0)) {
        throw new AppError('Select at least one day of the week for a weekly schedule', 400);
    }
    if (frequency === 'MONTHLY' && (!daysOfMonth || daysOfMonth.length === 0)) {
        throw new AppError('Select at least one day of the month for a monthly schedule', 400);
    }
};

// Two stops in the same list (both pickups, or both dropoffs) sharing the
// same time means a single bus would have to be at two places at once —
// invalid regardless of whether the name/address also match. Pickups are
// always assumed same-day as departure and dropoffs same-day as arrival, so
// this per-list check holds regardless of arrivalDayOffset.
const assertUniqueStopTimes = (points, label) => {
    const seen = new Set();
    for (const p of points || []) {
        if (!p.time) continue;
        if (seen.has(p.time)) {
            throw new AppError(`Duplicate ${label} time ${p.time} — a bus cannot be at two ${label} points at once`, 400);
        }
        seen.add(p.time);
    }
};

// The same physical stop (name + address) appearing twice in the same list
// is a data-entry mistake regardless of the times differing — one pickup
// point can't represent the same place visited twice in a single schedule.
const assertUniqueStopLocations = (points, label) => {
    const seen = new Set();
    for (const p of points || []) {
        if (!p.name || !p.address) continue;
        const key = `${p.name.trim().toLowerCase()}|${p.address.trim().toLowerCase()}`;
        if (seen.has(key)) {
            throw new AppError(`Duplicate ${label} stop "${p.name}" — a stop can only appear once`, 400);
        }
        seen.add(key);
    }
};

// Pickup points are assumed to happen on the departure day (day 0), dropoff
// points on the arrival day (day arrivalDayOffset). For a same-day schedule
// (offset 0), pickups must fall in [departure, arrival), dropoffs in
// (departure, arrival], and every dropoff must be strictly after the latest
// pickup — a bus can't be picking up and dropping off at the same moment. For
// a multi-day schedule (offset >= 1), pickups just need to be at/after
// departure (they're on day 0) and dropoffs at/before arrival (they're on day
// N); the two groups can never collide since they're on different calendar
// days regardless of how many days apart.
const assertStopsWithinWindow = (pickupPoints, dropoffPoints, departureTime, arrivalTime, arrivalDayOffset) => {
    for (const p of pickupPoints || []) {
        if (p.time && p.time < departureTime) {
            throw new AppError(`Pickup time ${p.time} cannot be before departure (${departureTime})`, 400);
        }
    }

    if (!arrivalDayOffset) {
        for (const p of pickupPoints || []) {
            if (p.time && p.time >= arrivalTime) {
                throw new AppError(`Pickup time ${p.time} must be before arrival (${arrivalTime})`, 400);
            }
        }
        for (const p of dropoffPoints || []) {
            if (p.time && (p.time <= departureTime || p.time > arrivalTime)) {
                throw new AppError(`Dropoff time ${p.time} must be between departure (${departureTime}) and arrival (${arrivalTime})`, 400);
            }
        }
        let maxPickupTime = '';
        for (const p of pickupPoints || []) {
            if (p.time && p.time > maxPickupTime) maxPickupTime = p.time;
        }
        for (const p of dropoffPoints || []) {
            if (p.time && maxPickupTime && p.time <= maxPickupTime) {
                throw new AppError(`Dropoff time ${p.time} must be after the last pickup time (${maxPickupTime})`, 400);
            }
        }
    } else {
        for (const p of dropoffPoints || []) {
            if (p.time && p.time > arrivalTime) {
                throw new AppError(`Dropoff time ${p.time} must be at or before arrival (${arrivalTime}) on day ${arrivalDayOffset + 1} of the trip`, 400);
            }
        }
    }
};

// A schedule "occupies" its bus for [departureTime, departureTime+duration),
// where duration can span multiple days for a long-haul route. Two schedules
// conflict if those occupied windows overlap on the repeating 24h clock —
// checked here across enough day-cycles to cover the longer of the two
// durations (so a 2-night route's window is compared against every cycle it
// could possibly touch, not just the adjacent day). Ignores recurrence/
// day-of-week (the existing recurrence model has no real day-of-week
// granularity either), so this is a conservative time-of-day check rather
// than a full calendar-aware one.
const durationMinutes = (depMin, arrMin, arrivalDayOffset) =>
    arrivalDayOffset ? (arrivalDayOffset * 1440 - depMin) + arrMin : arrMin - depMin;

const windowsOverlap = (start1, duration1, start2, duration2) => {
    const cycles = Math.ceil(Math.max(duration1, duration2) / 1440) + 1;
    for (let cycle = -cycles; cycle <= cycles; cycle++) {
        const shiftedStart2 = start2 + 1440 * cycle;
        if (start1 < shiftedStart2 + duration2 && shiftedStart2 < start1 + duration1) return true;
    }
    return false;
};

const assertNoBusTimeConflict = async (partnerId, busId, departureTime, arrivalTime, arrivalDayOffset, excludeScheduleId) => {
    const depMin = timeToMinutes(departureTime);
    const arrMin = timeToMinutes(arrivalTime);
    const duration = durationMinutes(depMin, arrMin, arrivalDayOffset);

    const filter = { partnerId, busId, isActive: true };
    if (excludeScheduleId) {
        filter._id = { $ne: excludeScheduleId };
    }

    const busSchedules = await Schedule.find(filter).select('departureTime arrivalTime arrivalDayOffset scheduleCode').lean();

    const conflict = busSchedules.find((s) => {
        const sDep = timeToMinutes(s.departureTime);
        const sArr = timeToMinutes(s.arrivalTime);
        const sDuration = durationMinutes(sDep, sArr, s.arrivalDayOffset);
        return windowsOverlap(depMin, duration, sDep, sDuration);
    });

    if (conflict) {
        throw new AppError(
            `This bus is already scheduled from ${conflict.departureTime} to ${conflict.arrivalTime}${conflict.arrivalDayOffset ? ` (+${conflict.arrivalDayOffset} day${conflict.arrivalDayOffset > 1 ? 's' : ''})` : ''} (schedule ${conflict.scheduleCode}) — times overlap`,
            409
        );
    }
};

const createSchedule = async (partnerId, data) => {
    const {
        routeId, busId, departureTime, arrivalTime, arrivalDayOffset,
        basePrice, recurrenceType, recurrenceRule,
        pickupPoints, dropoffPoints, operationNotes
    } = data;

    const route = await Route.findOne({ _id: routeId, partnerId, isActive: true, deletedAt: null });
    if (!route) {
        throw new AppError('Route not found or does not belong to your account', 404);
    }

    const bus = await Bus.findOne({ _id: busId, partnerId, isActive: true, status: 'ACTIVE' });
    if (!bus) {
        throw new AppError('Bus not found, not active, or currently under maintenance', 404);
    }

    assertValidTimeRange(departureTime, arrivalTime, arrivalDayOffset);
    assertUniqueStopTimes(pickupPoints, 'pickup');
    assertUniqueStopTimes(dropoffPoints, 'dropoff');
    assertUniqueStopLocations(pickupPoints, 'pickup');
    assertUniqueStopLocations(dropoffPoints, 'dropoff');
    assertStopsWithinWindow(pickupPoints, dropoffPoints, departureTime, arrivalTime, arrivalDayOffset);
    await assertNoBusTimeConflict(partnerId, busId, departureTime, arrivalTime, arrivalDayOffset);

    const startDate = recurrenceRule?.startDate ? new Date(recurrenceRule.startDate) : new Date();
    const endDate = recurrenceRule?.endDate ? new Date(recurrenceRule.endDate) : null;
    assertValidDateRange(startDate, endDate);

    const frequency = recurrenceRule?.frequency || recurrenceType || 'DAILY';
    const daysOfWeek = recurrenceRule?.daysOfWeek || [];
    const daysOfMonth = recurrenceRule?.daysOfMonth || [];
    assertRecurrenceDaysSelected(frequency, daysOfWeek, daysOfMonth);

    const schedule = await Schedule.create({
        routeId,
        busId,
        partnerId,
        scheduleCode: generateScheduleCode(),
        basePrice,
        departureTime,
        arrivalTime,
        arrivalDayOffset: arrivalDayOffset || 0,
        recurrenceType: recurrenceType || 'DAILY',
        recurrenceRule: {
            frequency,
            interval: recurrenceRule?.interval || 1,
            daysOfWeek,
            daysOfMonth,
            startDate,
            endDate
        },
        operationNotes: operationNotes || '',
        isActive: true
    });

    const pickupDocs = pickupPoints.map((p, i) => ({
        scheduleId: schedule._id,
        name: p.name,
        address: p.address,
        province: p.province || null,
        provinceName: p.provinceName || null,
        district: p.district || null,
        districtName: p.districtName || null,
        time: p.time,
        lat: p.lat || null,
        lng: p.lng || null,
        orderIndex: p.orderIndex ?? i
    }));

    const dropoffDocs = dropoffPoints.map((p, i) => ({
        scheduleId: schedule._id,
        name: p.name,
        address: p.address,
        province: p.province || null,
        provinceName: p.provinceName || null,
        district: p.district || null,
        districtName: p.districtName || null,
        time: p.time,
        lat: p.lat || null,
        lng: p.lng || null,
        orderIndex: p.orderIndex ?? i
    }));

    const [createdPickups, createdDropoffs] = await Promise.all([
        SchedulePickupPoint.insertMany(pickupDocs),
        ScheduleDropoffPoint.insertMany(dropoffDocs)
    ]);

    return {
        schedule: {
            ...schedule.toObject(),
            route: {
                _id: route._id,
                routeName: route.routeName,
                origin_provinceName: route.origin_provinceName,
                destination_provinceName: route.destination_provinceName
            },
            bus: {
                _id: bus._id,
                busName: bus.busName,
                licensePlate: bus.licensePlate,
                busType: bus.busType,
                totalSeats: bus.totalSeats
            }
        },
        pickupPoints: createdPickups,
        dropoffPoints: createdDropoffs
    };
};

const getSchedulesByPartner = async (partnerId, { page = 1, limit = 20 } = {}) => {
    const skip = (page - 1) * limit;

    const [schedules, total] = await Promise.all([
        Schedule.find({ partnerId, isActive: true })
            .populate('routeId', 'routeName origin_provinceName destination_provinceName')
            .populate('busId', 'busName licensePlate busType totalSeats')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Schedule.countDocuments({ partnerId, isActive: true })
    ]);

    const scheduleIds = schedules.map(s => s._id);
    const [pickups, dropoffs] = await Promise.all([
        SchedulePickupPoint.find({ scheduleId: { $in: scheduleIds } }).sort({ orderIndex: 1 }).lean(),
        ScheduleDropoffPoint.find({ scheduleId: { $in: scheduleIds } }).sort({ orderIndex: 1 }).lean()
    ]);

    const pickupMap = {};
    const dropoffMap = {};
    pickups.forEach(p => {
        const key = p.scheduleId.toString();
        if (!pickupMap[key]) pickupMap[key] = [];
        pickupMap[key].push(p);
    });
    dropoffs.forEach(d => {
        const key = d.scheduleId.toString();
        if (!dropoffMap[key]) dropoffMap[key] = [];
        dropoffMap[key].push(d);
    });

    const result = schedules.map(s => ({
        ...s,
        pickupPoints: pickupMap[s._id.toString()] || [],
        dropoffPoints: dropoffMap[s._id.toString()] || []
    }));

    return { schedules: result, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const getPartnerRoutes = async (partnerId) => {
    return Route.find({ partnerId, isActive: true, deletedAt: null })
        .select('routeName origin_provinceName destination_provinceName origin_province destination_province distanceKm estimatedDuration')
        .sort({ routeName: 1 })
        .lean();
};

const getPartnerBuses = async (partnerId) => {
    return Bus.find({ partnerId, isActive: true, status: 'ACTIVE' })
        .select('busName licensePlate busType totalSeats amenities seatLayout_totalRows seatLayout_totalColumns seatLayout_totalFloors')
        .sort({ busName: 1 })
        .lean();
};

const getScheduleById = async (partnerId, scheduleId) => {
    const schedule = await Schedule.findOne({ _id: scheduleId, partnerId, isActive: true })
        .populate('routeId', 'routeName origin_provinceName destination_provinceName origin_province destination_province distanceKm estimatedDuration')
        .populate('busId', 'busName licensePlate busType totalSeats amenities status')
        .lean();

    if (!schedule) {
        throw new AppError('Schedule not found or does not belong to your account', 404);
    }

    const [pickupPoints, dropoffPoints] = await Promise.all([
        SchedulePickupPoint.find({ scheduleId: schedule._id }).sort({ orderIndex: 1 }).lean(),
        ScheduleDropoffPoint.find({ scheduleId: schedule._id }).sort({ orderIndex: 1 }).lean()
    ]);

    return { ...schedule, pickupPoints, dropoffPoints };
};

const updateSchedule = async (partnerId, scheduleId, data) => {
    const schedule = await Schedule.findOne({ _id: scheduleId, partnerId, isActive: true });
    if (!schedule) {
        throw new AppError('Schedule not found or does not belong to your account', 404);
    }

    const {
        routeId, busId, departureTime, arrivalTime, arrivalDayOffset,
        basePrice, recurrenceType, recurrenceRule,
        pickupPoints, dropoffPoints, operationNotes
    } = data;

    if (routeId && routeId !== schedule.routeId.toString()) {
        const route = await Route.findOne({ _id: routeId, partnerId, isActive: true, deletedAt: null });
        if (!route) throw new AppError('Route not found or does not belong to your account', 404);
    }

    if (busId && busId !== schedule.busId.toString()) {
        const bus = await Bus.findOne({ _id: busId, partnerId, isActive: true, status: 'ACTIVE' });
        if (!bus) throw new AppError('Bus not found, not active, or currently under maintenance', 404);
    }

    const checkBusId = busId || schedule.busId;
    const checkDepartureTime = departureTime || schedule.departureTime;
    const checkArrivalTime = arrivalTime || schedule.arrivalTime;
    const checkArrivalDayOffset = arrivalDayOffset !== undefined ? arrivalDayOffset : schedule.arrivalDayOffset;

    assertValidTimeRange(checkDepartureTime, checkArrivalTime, checkArrivalDayOffset);
    if (pickupPoints) assertUniqueStopTimes(pickupPoints, 'pickup');
    if (dropoffPoints) assertUniqueStopTimes(dropoffPoints, 'dropoff');
    if (pickupPoints) assertUniqueStopLocations(pickupPoints, 'pickup');
    if (dropoffPoints) assertUniqueStopLocations(dropoffPoints, 'dropoff');
    if (pickupPoints || dropoffPoints) {
        assertStopsWithinWindow(pickupPoints || [], dropoffPoints || [], checkDepartureTime, checkArrivalTime, checkArrivalDayOffset);
    }
    await assertNoBusTimeConflict(partnerId, checkBusId, checkDepartureTime, checkArrivalTime, checkArrivalDayOffset, scheduleId);

    const checkStartDate = recurrenceRule?.startDate ? new Date(recurrenceRule.startDate) : schedule.recurrenceRule.startDate;
    const checkEndDate = recurrenceRule?.endDate !== undefined
        ? (recurrenceRule.endDate ? new Date(recurrenceRule.endDate) : null)
        : schedule.recurrenceRule.endDate;
    assertValidDateRange(checkStartDate, checkEndDate);

    const checkFrequency = recurrenceRule?.frequency || schedule.recurrenceRule.frequency;
    const checkDaysOfWeek = recurrenceRule?.daysOfWeek !== undefined ? recurrenceRule.daysOfWeek : schedule.recurrenceRule.daysOfWeek;
    const checkDaysOfMonth = recurrenceRule?.daysOfMonth !== undefined ? recurrenceRule.daysOfMonth : schedule.recurrenceRule.daysOfMonth;
    assertRecurrenceDaysSelected(checkFrequency, checkDaysOfWeek, checkDaysOfMonth);

    if (routeId) schedule.routeId = routeId;
    if (busId) schedule.busId = busId;
    if (departureTime) schedule.departureTime = departureTime;
    if (arrivalTime) schedule.arrivalTime = arrivalTime;
    if (arrivalDayOffset !== undefined) schedule.arrivalDayOffset = arrivalDayOffset;
    const oldBasePrice = schedule.basePrice;
    if (basePrice !== undefined) schedule.basePrice = basePrice;
    if (recurrenceType) schedule.recurrenceType = recurrenceType;
    if (operationNotes !== undefined) schedule.operationNotes = operationNotes;

    if (recurrenceRule) {
        if (recurrenceRule.frequency) schedule.recurrenceRule.frequency = recurrenceRule.frequency;
        if (recurrenceRule.interval) schedule.recurrenceRule.interval = recurrenceRule.interval;
        if (recurrenceRule.daysOfWeek) schedule.recurrenceRule.daysOfWeek = recurrenceRule.daysOfWeek;
        if (recurrenceRule.daysOfMonth) schedule.recurrenceRule.daysOfMonth = recurrenceRule.daysOfMonth;
        if (recurrenceRule.startDate) schedule.recurrenceRule.startDate = new Date(recurrenceRule.startDate);
        if (recurrenceRule.endDate !== undefined) schedule.recurrenceRule.endDate = recurrenceRule.endDate ? new Date(recurrenceRule.endDate) : null;
    }

    await schedule.save();

    // basePrice only froze onto Trip.seats[].price at generation time (see
    // trip.service.js) — without this, editing a schedule's price silently
    // left every already-generated future trip selling at the stale price.
    // Only touch seats nobody has booked/held yet; already-committed seats
    // (and past/non-OPEN trips) are left untouched.
    if (basePrice !== undefined && basePrice !== oldBasePrice) {
        await Trip.updateMany(
            { scheduleId, departureDate: { $gte: new Date() }, status: 'OPEN' },
            { $set: { 'seats.$[seat].price': basePrice } },
            { arrayFilters: [{ 'seat.status': 'AVAILABLE' }] }
        );
    }

    if (pickupPoints && pickupPoints.length > 0) {
        await SchedulePickupPoint.deleteMany({ scheduleId });
        const pickupDocs = pickupPoints.map((p, i) => ({
            scheduleId,
            name: p.name,
            address: p.address,
            province: p.province || null,
            provinceName: p.provinceName || null,
            district: p.district || null,
            districtName: p.districtName || null,
            time: p.time,
            lat: p.lat || null,
            lng: p.lng || null,
            orderIndex: p.orderIndex ?? i
        }));
        await SchedulePickupPoint.insertMany(pickupDocs);
    }

    if (dropoffPoints && dropoffPoints.length > 0) {
        await ScheduleDropoffPoint.deleteMany({ scheduleId });
        const dropoffDocs = dropoffPoints.map((p, i) => ({
            scheduleId,
            name: p.name,
            address: p.address,
            province: p.province || null,
            provinceName: p.provinceName || null,
            district: p.district || null,
            districtName: p.districtName || null,
            time: p.time,
            lat: p.lat || null,
            lng: p.lng || null,
            orderIndex: p.orderIndex ?? i
        }));
        await ScheduleDropoffPoint.insertMany(dropoffDocs);
    }

    return getScheduleById(partnerId, scheduleId);
};

const deleteSchedule = async (partnerId, scheduleId) => {
    const schedule = await Schedule.findOne({ _id: scheduleId, partnerId, isActive: true });
    if (!schedule) {
        throw new AppError('Schedule not found or does not belong to your account', 404);
    }

    // Deactivating the schedule only stops NEW trips from being generated —
    // it never touched trips already materialized for future dates, which
    // stayed silently bookable forever. Block the delete if any of those
    // already have a paying/held customer on them; otherwise cancel them.
    const futureTrips = await Trip.find({
        scheduleId,
        departureDate: { $gte: new Date() },
        status: { $in: ['OPEN', 'DELAYED'] }
    }).select('_id tripCode bookedSeats heldSeats');

    const blockedTrip = futureTrips.find((t) => t.bookedSeats > 0 || t.heldSeats > 0);
    if (blockedTrip) {
        throw new AppError(
            `Cannot delete this schedule — trip ${blockedTrip.tripCode} still has active bookings or held seats. Cancel or resolve those first.`,
            409
        );
    }

    const futureTripIds = futureTrips.map((t) => t._id);
    if (futureTripIds.length > 0) {
        await Trip.updateMany({ _id: { $in: futureTripIds } }, { status: 'CANCELLED' });
    }

    await Promise.all([
        SchedulePickupPoint.deleteMany({ scheduleId }),
        ScheduleDropoffPoint.deleteMany({ scheduleId })
    ]);

    schedule.isActive = false;
    await schedule.save();

    return { scheduleId: schedule._id, scheduleCode: schedule.scheduleCode };
};

module.exports = {
    createSchedule,
    getSchedulesByPartner,
    getScheduleById,
    updateSchedule,
    deleteSchedule,
    getPartnerRoutes,
    getPartnerBuses
};
