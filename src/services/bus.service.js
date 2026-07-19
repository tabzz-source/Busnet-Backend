// src/services/bus.service.js
const Bus = require('../models/Bus');
const BusSeat = require('../models/BusSeat');
const Trip = require('../models/Trip');
const SubscriptionHistory = require('../models/SubscriptionHistory')

exports.getMyBuses = async (partnerId, query) => {
    const {
        page = 1,
        limit = 5,
        keyword,
        status,
        busType,
        isActive,
        minSeats,
        maxSeats
    } = query;

    const filter = {
        partnerId,
        isActive: true
    };

    if (keyword) {
        filter.$or = [
            { busName: { $regex: keyword, $options: 'i' } },
            { licensePlate: { $regex: keyword, $options: 'i' } }
        ];
    }

    if (status) {
        filter.status = status;
    }

    if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
    }

    if (busType) {
        filter.busType = busType;
    }

    if (status) {
        filter.status = status;
    }

    if (minSeats || maxSeats) {

        filter.totalSeats = {};

        if (minSeats) {
            filter.totalSeats.$gte = Number(minSeats);
        }

        if (maxSeats) {
            filter.totalSeats.$lte = Number(maxSeats);
        }

    }
    
    const buses = await Bus.find(filter)
        .select(
            'busName licensePlate busType totalSeats status seatLayout_totalFloors createdAt'
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean();

    const busIds = buses.map(bus => bus._id);

    const trips = await Trip.find({
        busId: { $in: busIds },
        departureDate: {
            $gte: new Date()
        }
    }).select('busId');

    const busInUseSet = new Set(
        trips.map(trip => trip.busId.toString())
    );

    const busesWithStatus = buses.map(bus => ({
        ...bus,
        isInUse: busInUseSet.has(bus._id.toString())
    }));

    const total = await Bus.countDocuments(filter);

    const activeSubscription = await SubscriptionHistory.findOne({
        partnerId,
        subscriptionStatus: 'ACTIVE',
        expirationDate: { $gte: new Date() }
    }).populate('planId');


    let usage = null;

    if (activeSubscription) {
        const plan = activeSubscription.planId;

        const isLimitReached =
            plan.maxBuses > 0 &&
            total >= plan.maxBuses;

        usage = {
            planName: plan.planName,
            maxBuses: plan.maxBuses,
            currentBuses: total,
            canCreate: !isLimitReached
        };
    }

    return {
        data: busesWithStatus,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / limit)
        },
        usage
    };
};

exports.getBusDetails = async (routeId, partnerId) => {
    const bus = await Bus.findOne({
        _id: routeId,
        partnerId,
    });

    if (!bus) {
        const error = new Error('Bus not found');
        error.statusCode = 404;
        throw error;
    }

    return bus;
};

exports.createBus = async (partnerId, busData) => {

    const existingBus = await Bus.findOne({
        partnerId,
        licensePlate: busData.licensePlate,
    });

    if (existingBus) {
        const error = new Error(
            'A Bus with the same license plate already exists'
        );
        error.statusCode = 409;
        throw error;
    }

    const bus = await Bus.create({
        partnerId,
        ...busData
    });

    return bus;
};

exports.updateBus = async (busId, partnerId, updateData) => {

    const bus = await Bus.findOne({
        _id: busId,
        partnerId,
        isActive: true
    });

    if (!bus) {
        const error = new Error('Bus not found');
        error.statusCode = 404;
        throw error;
    }

    // Fields that cannot be updated from this API
    const lockedFields = [
        'partnerId',
        'totalSeats',
        'seatLayout_totalRows',
        'seatLayout_totalColumns',
        'seatLayout_totalFloors',
        'createdAt',
        'updatedAt'
    ];

    lockedFields.forEach(field => delete updateData[field]);

    // Check duplicate license plate
    if (
        updateData.licensePlate &&
        updateData.licensePlate !== bus.licensePlate
    ) {

        const existed = await Bus.findOne({
            _id: { $ne: busId },
            licensePlate: updateData.licensePlate.toUpperCase()
        });

        if (existed) {
            const error = new Error('License plate already exists');
            error.statusCode = 409;
            throw error;
        }

        const futureTrip = await Trip.findOne({
            busId: bus._id,
            departureDate: {
                $gte: new Date()
            }
        });

        if (futureTrip) {
            const error = new Error(
                'This bus is being used by future trips and cannot be updated.'
            );
            error.statusCode = 409;
            throw error;
        }

        updateData.licensePlate =
            updateData.licensePlate.toUpperCase();
    }

    Object.assign(bus, updateData);

    await bus.save();

    return bus;
};

exports.deleteBus = async (busId, partnerId) => {

    const bus = await Bus.findOne({
        _id: busId,
        partnerId,
    });

    if (!bus) {
        const error = new Error('Bus not found');
        error.statusCode = 404;
        throw error;
    }

    // Check if this bus is assigned to any future trips
    const futureTrip = await Trip.findOne({
        busId: bus._id,
        departureDate: {
            $gte: new Date(),
        },
    });

    if (futureTrip) {
        const error = new Error(
            'Cannot delete bus because future trips exist.'
        );
        error.statusCode = 409;
        throw error;
    }

    // Soft delete the bus
    bus.isActive = false;
    await bus.save();

    // Soft delete all seats belonging to the bus
    await BusSeat.updateMany(
        { busId: bus._id },
        {
            $set: {
                isActive: false,
            },
        }
    );

    return bus;
};

exports.configureSeatLayout = async (
    busId,
    partnerId,
    data
) => {

    const bus = await Bus.findOne({
        _id: busId,
        partnerId
    });

    if (!bus) {
        const error = new Error('Bus not found');
        error.statusCode = 404;
        throw error;
    }

    const futureTrip = await Trip.findOne({
        busId,
        departureDate: {
            $gte: new Date()
        }
    });

    if (futureTrip) {
        const error = new Error(
            'This bus already has future trips.'
        );
        error.statusCode = 409;
        throw error;
    }

    const { layout } = data;

    if (!Array.isArray(layout) || layout.length === 0) {
        const error = new Error('Layout is required.');
        error.statusCode = 400;
        throw error;
    }

    let allowedSeatTypes = [];

    switch (bus.busType) {

        case 'Seater':
            allowedSeatTypes = [
                'SEAT',
                'AISLE',
                'EMPTY'
            ];
            break;

        case 'Sleeper':
            allowedSeatTypes = [
                'SLEEPER',
                'AISLE',
                'EMPTY'
            ];
            break;

        case 'Limousine':
            allowedSeatTypes = [
                'LIMOUSINE_SEAT',
                'LIMOUSINE_SLEEPER',
                'AISLE',
                'EMPTY'
            ];
            break;

        default:
            const error = new Error('Invalid bus type.');
            error.statusCode = 400;
            throw error;
    }

    // -----------------------------
    // Validate layout
    // -----------------------------

    const rowCount = layout[0].length;
    const columnCount = layout[0][0].length;

    let totalSeats = 0;

    for (const floor of layout) {

        if (!Array.isArray(floor) || floor.length === 0) {
            const error = new Error('Each floor must contain rows.');
            error.statusCode = 400;
            throw error;
        }

        if (floor.length !== rowCount) {
            const error = new Error(
                'All floors must have the same number of rows.'
            );
            error.statusCode = 400;
            throw error;
        }

        for (const row of floor) {

            if (!Array.isArray(row) || row.length === 0) {
                const error = new Error(
                    'Each row must contain columns.'
                );
                error.statusCode = 400;
                throw error;
            }

            if (row.length !== columnCount) {
                const error = new Error(
                    'All rows must have the same number of columns.'
                );
                error.statusCode = 400;
                throw error;
            }

            for (const cell of row) {

                if (!allowedSeatTypes.includes(cell)) {
                    const error = new Error(
                        `Seat type "${cell}" is not allowed for ${bus.busType}.`
                    );
                    error.statusCode = 400;
                    throw error;
                }

                if (
                    cell !== 'AISLE' &&
                    cell !== 'EMPTY'
                ) {
                    totalSeats++;
                }

            }

        }

    }

    if (totalSeats === 0) {
        const error = new Error(
            'The layout must contain at least one seat.'
        );
        error.statusCode = 400;
        throw error;
    }

    // -----------------------------
    // Safe to replace layout
    // -----------------------------

    await BusSeat.deleteMany({ busId });

    const seats = [];

    for (let floor = 0; floor < layout.length; floor++) {

        const floorLayout = layout[floor];

        for (let row = 0; row < floorLayout.length; row++) {

            let seatNumber = 1;

            for (
                let column = 0;
                column < floorLayout[row].length;
                column++
            ) {

                const cell = floorLayout[row][column];

                if (
                    cell === 'AISLE' ||
                    cell === 'EMPTY'
                ) {
                    continue;
                }

                const seatCode =
                    `F${floor + 1}-${String.fromCharCode(65 + row)}${seatNumber}`;

                seatNumber++;

                seats.push({
                    busId,
                    seatCode,
                    seatType: cell,
                    floor: floor + 1,
                    row: row + 1,
                    column: column + 1,
                    isActive: true,
                    priceModifier: 0
                });

            }

        }

    }

    await BusSeat.insertMany(seats);

    bus.totalSeats = totalSeats;
    bus.seatLayout_totalRows = rowCount;
    bus.seatLayout_totalColumns = columnCount;
    bus.seatLayout_totalFloors = layout.length;
    bus.status = 'ACTIVE';

    await bus.save();

    return bus;
};

exports.getSeatLayout = async (
    busId,
    partnerId
) => {

    const bus = await Bus.findOne({
        _id: busId,
        partnerId
    });

    if (!bus) {
        const error = new Error("Bus not found");
        error.statusCode = 404;
        throw error;
    }

    const seats = await BusSeat.find({
        busId,
        isActive: true
    });

    const layout = [];

    for (
        let floor = 0;
        floor < bus.seatLayout_totalFloors;
        floor++
    ) {

        const floorLayout = [];

        for (
            let row = 0;
            row < bus.seatLayout_totalRows;
            row++
        ) {

            const rowLayout = [];

            for (
                let column = 0;
                column < bus.seatLayout_totalColumns;
                column++
            ) {

                rowLayout.push("EMPTY");

            }

            floorLayout.push(rowLayout);

        }

        layout.push(floorLayout);

    }

    for (const seat of seats) {

        layout[
            seat.floor - 1
        ][
            seat.row - 1
        ][
            seat.column - 1
        ] = seat.seatType;

    }

    const aisleColumn = Math.floor(
        bus.seatLayout_totalColumns / 2
    );

    for (let floor = 0; floor < layout.length; floor++) {

        for (let row = 0; row < layout[floor].length; row++) {

            if (
                layout[floor][row][aisleColumn] === "EMPTY"
            ) {
                layout[floor][row][aisleColumn] = "AISLE";
            }

        }

    }

    return {

        rows: bus.seatLayout_totalRows,

        columns: bus.seatLayout_totalColumns,

        floors: bus.seatLayout_totalFloors,

        layout

    };
}