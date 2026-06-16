
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
    {
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            default: null,
            index: true
        },

        senderAccountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            default: null,
            index: true
        },

        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            default: null,
            index: true
        },

        subscriptionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PartnerSubscription',
            default: null,
            index: true
        },

        transactionType: {
            type: String,
            enum: ['BOOKING_PAYMENT', 'SUBSCRIPTION_PAYMENT', 'REFUND', 'OTHER'],
            required: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        currency: {
            type: String,
            default: 'VND'
        },

        status: {
            type: String,
            enum: ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'REFUNDED', 'CANCELLED'],
            default: 'PENDING',
            index: true
        },

        expiresAt: {
            type: Date,
            default: null
        },

        sepayTransactionId: {
            type: String,
            trim: true,
            default: null
        },

        gateway: {
            type: String,
            default: null
        },

        transactionDate: {
            type: Date,
            default: Date.now
        },

        accountNumber: {
            type: String,
            default: null
        },

        code: {
            type: String,
            default: null
        },

        content: {
            type: String,
            default: null
        },

        transferAmount: {
            type: Number,
            default: 0
        },

        transferType: {
            type: String,
            default: null
        },

        accumulated: {
            type: Number,
            default: 0
        },

        subAccount: {
            type: String,
            default: null
        },

        referenceCode: {
            type: String,
            default: null
        },

        description: {
            type: String,
            default: ''
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true,
        collection: 'transactions'
    }
);

module.exports = mongoose.model('Transaction', transactionSchema);