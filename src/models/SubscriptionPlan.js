

const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema(
    {
        planName: {
            type: String,
            required: true,
            trim: true
        },

        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },

        description: {
            type: String,
            default: ''
        },

        price: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },

        durationDays: {
            type: Number,
            required: true,
            min: 1
        },

        discount: {
            type: Number,
            default: 0,
            min: 0
        },

        planFeatures: {
            type: [String],
            default: []
        },

        maxBuses: {
            type: Number,
            default: 0,
            min: 0
        },

        maxRoutes: {
            type: Number,
            default: 0,
            min: 0
        },

        isPopular: {
            type: Boolean,
            default: false
        },

        status: {
            type: String,
            enum: ['ACTIVE', 'INACTIVE', 'DELETED'],
            default: 'ACTIVE'
        },

        chartColor: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true,
        collection: 'subscription_plans'
    }
);

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);