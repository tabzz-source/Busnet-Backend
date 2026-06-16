const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
    {
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Route',
            required: true,
            index: true
        },

        busId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Bus',
            required: true,
            index: true
        },

        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            index: true
        },

        scheduleCode: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        basePrice: {
            type: Number,
            required: true,
            min: 0
        },

        departureTime: {
            type: String,
            required: true,
            match: /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
        },

        arrivalTime: {
            type: String,
            required: true,
            match: /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
        },

        recurrenceType: {
            type: String,
            enum: ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
            required: true,
            default: 'DAILY'
        },

        recurrenceRule: {
            frequency: {
                type: String,
                enum: ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'],
                default: 'DAILY'
            },

            interval: {
                type: Number,
                default: 1,
                min: 1
            },

            daysOfWeek: {
                type: [Number],
                default: []
            },

            daysOfMonth: {
                type: [Number],
                default: []
            },

            startDate: {
                type: Date,
                required: true
            },

            endDate: {
                type: Date,
                default: null
            },

            count: {
                type: Number,
                default: null
            }
        },

        customDates: {
            type: [Date],
            default: []
        },

        exceptionDates: {
            type: [Date],
            default: []
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
        collection: 'schedules'
    }
);

module.exports = mongoose.model('Schedule', scheduleSchema);