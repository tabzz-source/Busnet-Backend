
const mongoose = require('mongoose');

const subscriptionHistorySchema = new mongoose.Schema(
    {
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            index: true
        },

        planId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SubscriptionPlan',
            required: true
        },

        transactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transaction',
            default: null
        },

        subscriptionDate: {
            type: Date,
            required: true
        },

        expirationDate: {
            type: Date,
            required: true
        },

        subscriptionStatus: {
            type: String,
            enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'],
            required: true
        }
    },
    {
        timestamps: true,
        collection: 'subscription_histories'
    }
);

module.exports = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);