// src/controllers/partner/partnerBus.controller.js
const busService = require('../../services/bus.service');

exports.getMyBuses = async (req, res) => {
    try {
        const result = await busService.getMyBuses(
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

exports.getBusDetails = async (req, res) => {
    try {
        const { busId } = req.params;

        const bus = await busService.getBusDetails(
            busId,
            req.user?.id
        );

        return res.status(200).json({
            success: true,
            data: bus
        });

    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

exports.createBus = async (req, res) => {
    try {
        const route = await busService.createBus(
            req.user?.id,
            req.body
        );

        return res.status(201).json({
            success: true,
            message: 'Bus created successfully',
            data: route
        });

    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

exports.updateBus = async (req, res) => {
    try {
        const { busId } = req.params;

        const bus = await busService.updateBus(
            busId,
            req.user?.id,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: 'Bus updated successfully',
            data: bus
        });

    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

exports.deleteBus = async (req, res) => {
    try {
        const { busId } = req.params;
        
        const bus = await busService.deleteBus(
            busId,
            req.user?.id,
        );

        return res.status(200).json({
            success: true,
            message: `Bus deleted successfully`,
            data: bus
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

exports.configureSeatLayout = async (req, res) => {

    const bus = await busService.configureSeatLayout(
        req.params.busId,
        req.user?.id,
        req.body
    );

    res.json({
        success: true,
        message: 'Seat layout configured successfully.',
        data: bus
    });

};

exports.getSeatLayout = async (req, res, next) => {
    try {

        const data = await busService.getSeatLayout(
            req.params.busId,
            req.user.id
        );

        res.json({
            success: true,
            data
        });

    } catch (err) {
        next(err);
    }
};
