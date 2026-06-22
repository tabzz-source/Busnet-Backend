const Schedule = require('../models/Schedule');
const SchedulePickupPoint = require('../models/SchedulePickupPoint');
const ScheduleDropoffPoint = require('../models/ScheduleDropoffPoint');
const Route = require('../models/Route');
const Bus = require('../models/Bus');
const AppError = require('../utils/AppError');

const generateScheduleCode = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SCH-${timestamp}-${random}`;
};

const createSchedule = async (partnerId, data) => {
    const {
        routeId, busId, departureTime, arrivalTime,
        basePrice, recurrenceType, recurrenceRule,
        pickupPoints, dropoffPoints, operationNotes
    } = data;

    const route = await Route.findOne({ _id: routeId, partnerId, isActive: true, deletedAt: null });
    if (!route) {
        throw new AppError('Route not found or does not belong to your account', 404);
    }

    const bus = await Bus.findOne({ _id: busId, partnerId, isActive: true });
    if (!bus) {
        throw new AppError('Bus not found or does not belong to your account', 404);
    }

    const existingSchedule = await Schedule.findOne({
        routeId,
        busId,
        partnerId,
        departureTime,
        isActive: true
    });
    if (existingSchedule) {
        throw new AppError('A schedule with the same route, bus and departure time already exists', 409);
    }

    const schedule = await Schedule.create({
        routeId,
        busId,
        partnerId,
        scheduleCode: generateScheduleCode(),
        basePrice,
        departureTime,
        arrivalTime,
        recurrenceType: recurrenceType || 'DAILY',
        recurrenceRule: {
            frequency: recurrenceRule?.frequency || recurrenceType || 'DAILY',
            interval: recurrenceRule?.interval || 1,
            daysOfWeek: recurrenceRule?.daysOfWeek || [],
            daysOfMonth: recurrenceRule?.daysOfMonth || [],
            startDate: recurrenceRule?.startDate ? new Date(recurrenceRule.startDate) : new Date(),
            endDate: recurrenceRule?.endDate ? new Date(recurrenceRule.endDate) : null
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

module.exports = {
    createSchedule,
    getSchedulesByPartner,
    getPartnerRoutes,
    getPartnerBuses
};
