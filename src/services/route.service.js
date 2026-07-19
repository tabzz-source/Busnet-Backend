// src/services/route.service.js
const Route = require('../models/Route');
const Trip = require('../models/Trip');
const Booking = require('../models/Booking');

exports.getMyRoutes = async (partnerId, query) => {
    const {
        page = 1,
        limit = 5,
        keyword,
        isActive
    } = query;

    const filter = {
        partnerId,
    };

    if (keyword) {
        filter.routeName = {
            $regex: keyword,
            $options: 'i'
        };
    }

    if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
    }

    const routes = await Route.find(filter)
        .select(
            'routeName origin_provinceName destination_provinceName distanceKm estimatedDuration isActive'
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

    const total = await Route.countDocuments(filter);

    return {
        data: routes,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

exports.getRouteDetails = async (routeId, partnerId) => {
    const route = await Route.findOne({
        _id: routeId,
        partnerId,
        deletedAt: null
    });

    if (!route) {
        const error = new Error('Route not found');
        error.statusCode = 404;
        throw error;
    }

    return route;
};

exports.createRoute = async (partnerId, routeData) => {

    const existingRoute = await Route.findOne({
        partnerId,
        origin_province: routeData.origin_province,
        destination_province: routeData.destination_province,
        deletedAt: null
    });

    if (existingRoute) {
        const error = new Error(
            'A route with the same origin and destination already exists'
        );
        error.statusCode = 409;
        throw error;
    }

    const route = await Route.create({
        partnerId,
        ...routeData
    });

    return route;
};

exports.updateRoute = async (routeId, partnerId, updateData) => {

    const route = await Route.findOne({
        _id: routeId,
        partnerId,
        deletedAt: null
    });

    if (!route) {
        const error = new Error('Route not found');
        error.statusCode = 404;
        throw error;
    }

    const lockedFields = [
        'origin_province',
        'origin_provinceName',
        'destination_province',
        'destination_provinceName',
        'distanceKm',
        'estimatedDuration',
        'routePolyline'
    ];

    const isChangingRouteDefinition = lockedFields.some(
        field => field in updateData
    );

    if (isChangingRouteDefinition) {

        const futureTrip = await Trip.findOne({
            routeId,
            departureDate: {
                $gte: new Date()
            }
        });

        if (futureTrip) {
            const error = new Error(
                'Cannot modify route because it is being used by future trips'
            );

            error.statusCode = 409;
            throw error;
        }
    }

    Object.assign(route, updateData);

    await route.save();

    return route;
};

exports.toggleRouteStatus = async (routeId, partnerId, isActive) => {

    const route = await Route.findOne({
        _id: routeId,
        partnerId,
        deletedAt: null
    });

    if (!route) {
        const error = new Error('Route not found');
        error.statusCode = 404;
        throw error;
    }

    // Only check when disabling
    if (!isActive) {

        const futureTrip = await Trip.findOne({
            routeId: route._id,
            departureDate: {
                $gte: new Date()
            }
        });

        if (futureTrip) {
            const error = new Error(
                'Cannot disable route because future trips exist'
            );

            error.statusCode = 409;
            throw error;
        }
    }

    route.isActive = isActive;

    await route.save();

    return route;
};

