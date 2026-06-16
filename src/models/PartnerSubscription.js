
const mongoose = require('mongoose');

const partnerSubscriptionSchema = new mongoose.Schema(
    {
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            unique: true,
            index: true
        },

        planId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SubscriptionPlan',
            required: true
        },

        subscriptionDate: {
            type: Date,
            required: true,
            default: Date.now
        },

        expirationDate: {
            type: Date,
            required: true
        },

        subscriptionStatus: {
            type: String,
            enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'],
            default: 'PENDING'
        },

        autoRenew: {
            type: Boolean,
            default: false
        },

        cancelledAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        collection: 'partner_subscriptions'
    }
);

module.exports = mongoose.model('PartnerSubscription', partnerSubscriptionSchema);