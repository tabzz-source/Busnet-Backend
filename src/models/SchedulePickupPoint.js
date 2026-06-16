
const mongoose = require('mongoose');

const schedulePickupPointSchema = new mongoose.Schema(
    {
        scheduleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Schedule',
            required: true,
            index: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        address: {
            type: String,
            required: true,
            trim: true
        },

        province: {
            type: String,
            trim: true
        },

        provinceName: {
            type: String,
            trim: true
        },

        district: {
            type: String,
            trim: true
        },

        districtName: {
            type: String,
            trim: true
        },

        time: {
            type: String,
            required: true,
            match: /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
        },

        lat: {
            type: Number,
            default: null
        },

        lng: {
            type: Number,
            default: null
        },

        orderIndex: {
            type: Number,
            required: true,
            min: 0
        }
    },
    {
        timestamps: true,
        collection: 'schedule_pickup_points_embedded'
    }
);

schedulePickupPointSchema.index({ scheduleId: 1, orderIndex: 1 });

module.exports = mongoose.model('SchedulePickupPoint', schedulePickupPointSchema);