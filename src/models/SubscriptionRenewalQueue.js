
const mongoose = require('mongoose');

const subscriptionRenewalQueueSchema = new mongoose.Schema(
    {
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            unique: true,
            index: true
        },

        nextPlanId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SubscriptionPlan',
            required: true
        },

        targetStartDate: {
            type: Date,
            required: true
        },

        targetEndDate: {
            type: Date,
            required: true
        },

        status: {
            type: String,
            enum: ['PENDING', 'PROCESSED', 'CANCELLED', 'FAILED'],
            default: 'PENDING'
        },

        processedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        collection: 'subscription_renewal_queue'
    }
);

module.exports = mongoose.model(
    'SubscriptionRenewalQueue',
    subscriptionRenewalQueueSchema
);