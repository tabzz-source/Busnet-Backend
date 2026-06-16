// Route Model

const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema(
    {
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            index: true
        },

        routeName: {
            type: String,
            required: true,
            trim: true
        },

        origin_province: {
            type: String,
            required: true,
            trim: true
        },

        origin_provinceName: {
            type: String,
            required: true,
            trim: true
        },

        origin_district: {
            type: String,
            trim: true
        },

        origin_districtName: {
            type: String,
            trim: true
        },

        origin_representativeAddress: {
            type: String,
            trim: true
        },

        origin_representativeLat: {
            type: Number,
            default: null
        },

        origin_representativeLng: {
            type: Number,
            default: null
        },

        destination_province: {
            type: String,
            required: true,
            trim: true
        },

        destination_provinceName: {
            type: String,
            required: true,
            trim: true
        },

        destination_district: {
            type: String,
            trim: true
        },

        destination_districtName: {
            type: String,
            trim: true
        },

        destination_representativeAddress: {
            type: String,
            trim: true
        },

        destination_representativeLat: {
            type: Number,
            default: null
        },

        destination_representativeLng: {
            type: Number,
            default: null
        },

        distanceKm: {
            type: Number,
            default: 0,
            min: 0
        },

        estimatedDuration: {
            type: Number,
            default: 0,
            min: 0
        },

        routePolyline: {
            type: String,
            default: null
        },

        isActive: {
            type: Boolean,
            default: true
        },

        isPopular: {
            type: Boolean,
            default: false
        },

        deletedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        collection: 'routes'
    }
);

module.exports = mongoose.model('Route', routeSchema);