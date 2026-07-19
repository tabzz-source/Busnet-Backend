// src/services/route.service.js
const Route = require('../models/Route');
const Trip = require('../models/Trip');
const Booking = require('../models/Booking');
const geoCode = require('./geocode.service')
const SubscriptionHistory = require('../models/SubscriptionHistory');

exports.getMyRoutes = async (partnerId, query) => {
    const {
        page = 1,
        limit = 5,
        keyword,
        isActive
    } = query;


    const filter = {
        partnerId,
        deletedAt: null
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

    const activeSubscription = await SubscriptionHistory.findOne({
        partnerId,
        subscriptionStatus: 'ACTIVE',
        expirationDate: { $gte: new Date() }
    }).populate('planId');


    const total = await Route.countDocuments(filter);

    let usage = null;

    if (activeSubscription) {
        const plan = activeSubscription.planId;

        const isLimitReached =
            plan.maxRoutes > 0 &&
            total >= plan.maxRoutes;

        usage = {
            planName: plan.planName,
            maxRoutes: plan.maxRoutes,
            currentRoutes: total,
            canCreate: !isLimitReached
        };
    }

    return {
        data: routes,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / limit)
        },
        usage
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
        origin_district: routeData.origin_district,
        destination_province: routeData.destination_province,
        destination_district: routeData.destination_district,
        deletedAt: null,
    })

    if (existingRoute) {
        const error = new Error(
            'A route with the same origin and destination already exists'
        )
        error.statusCode = 409
        throw error
    }

    const originPlace =
        `${routeData.origin_provinceName}`
    const destinationPlace =
        `${routeData.destination_provinceName}`

    const originGeo = await geoCode.getCoordinates(originPlace)
    const destinationGeo = await geoCode.getCoordinates(destinationPlace)

    if (!originGeo || !destinationGeo) {
        const error = new Error('Geocoding failed')
        error.statusCode = 502
        throw error
    }

    const routeInfo = await geoCode.getRouteInfo(originGeo, destinationGeo)

    const route = await Route.create({
        partnerId,
        ...routeData,

        origin_representativeLat: originGeo.lat,
        origin_representativeLng: originGeo.lng,

        destination_representativeLat: destinationGeo.lat,
        destination_representativeLng: destinationGeo.lng,

        distanceKm: routeInfo.distanceKm,
        estimatedDuration: routeInfo.durationMin,
    })

    return route
}

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


        const originProvince =
            updateData.origin_provinceName ?? route.origin_provinceName;

        const destinationProvince =
            updateData.destination_provinceName ??
            route.destination_provinceName;

        const originGeo =
            await geoCode.getCoordinates(originProvince);

        const destinationGeo =
            await geoCode.getCoordinates(destinationProvince);

        const routeInfo =
            await geoCode.getRouteInfo(originGeo, destinationGeo);

        updateData.origin_representativeLat = originGeo.lat;
        updateData.origin_representativeLng = originGeo.lng;

        updateData.destination_representativeLat = destinationGeo.lat;
        updateData.destination_representativeLng = destinationGeo.lng;

        updateData.distanceKm = routeInfo.distanceKm;
        updateData.estimatedDuration =
            routeInfo.durationMin;
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