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

        // Number of calendar days after departureDate that arrivalTime falls
        // on — 0 for a same-day route, 1 for an overnight route (depart 22:00,
        // arrive 06:00 the next morning), 2+ for multi-night long-haul routes
        // (e.g. Hà Nội - TP.HCM can run 30+ hours). Without this, arrivalTime
        // <= departureTime is indistinguishable from an invalid same-day
        // schedule. All pickup points are assumed to happen on the departure
        // day (day 0) and all dropoff points on the arrival day (day N) — see
        // schedule.service.js.
        arrivalDayOffset: {
            type: Number,
            default: 0,
            min: 0
        },

        recurrenceType: {
            type: String,
            enum: ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
            required: true,
            default: 'DAILY'
        },

        recurrenceRule: {
            // Kept in sync with recurrenceType's own enum — schedule.service.js
            // defaults this to recurrenceType whenever the caller doesn't send
            // an explicit recurrenceRule.frequency, so the two must accept the
            // same value set or a valid ONCE/CUSTOM recurrenceType blows up
            // save() with an enum-mismatch error.
            frequency: {
                type: String,
                enum: ['NONE', 'ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'],
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

        operationNotes: {
            type: String,
            default: ''
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