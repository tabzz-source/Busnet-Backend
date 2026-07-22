
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

        operation: {
            type: String,
            enum: ['INITIAL', 'EXTEND', 'RENEW'],
            default: 'INITIAL'
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

subscriptionHistorySchema.index(
    { transactionId: 1 },
    { unique: true, sparse: true }
);
subscriptionHistorySchema.index({ partnerId: 1, subscriptionStatus: 1, subscriptionDate: 1 });

module.exports = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);
