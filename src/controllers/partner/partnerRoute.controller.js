// src/controllers/partner/partnerRoute.controller.js
const routeService = require('../../services/route.service');

exports.getMyRoutes = async (req, res) => {
    try {
        const result = await routeService.getMyRoutes(
            req.user?.id,
            req.query
        );

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getRouteDetails = async (req, res) => {
    try {
        const { routeId } = req.params;

        const route = await routeService.getRouteDetails(
            routeId,
            req.user?.id
        );

        return res.status(200).json({
            success: true,
            data: route
        });

    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

exports.createRoute = async (req, res) => {
    try {
        const route = await routeService.createRoute(
            req.user?.id,
            req.body
        );

        return res.status(201).json({
            success: true,
            message: 'Route created successfully',
            data: route
        });

    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

exports.updateRoutes = async (req, res) => {
    try {
        const { routeId } = req.params;

        const route = await routeService.updateRoute(
            routeId,
            req.user?.id,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: 'Route updated successfully',
            data: route
        });

    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

exports.toggleRouteStatus = async (req, res) => {
    try {
        const { routeId } = req.params;
        const { isActive } = req.body;

        
        const route = await routeService.toggleRouteStatus(
            routeId,
            req.user?.id,
            isActive
        );

        return res.status(200).json({
            success: true,
            message: `Route ${isActive ? 'enabled' : 'disabled'} successfully`,
            data: route
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};