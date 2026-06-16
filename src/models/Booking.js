
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
    {
        bookingCode: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            index: true
        },

        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            index: true
        },

        tripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Trip',
            required: true,
            index: true
        },

        pickupPoint_name: {
            type: String,
            required: true,
            trim: true
        },

        pickupPoint_address: {
            type: String,
            required: true,
            trim: true
        },

        pickupPoint_time: {
            type: String,
            required: true
        },

        dropoffPoint_name: {
            type: String,
            required: true,
            trim: true
        },

        dropoffPoint_address: {
            type: String,
            required: true,
            trim: true
        },

        dropoffPoint_time: {
            type: String,
            required: true
        },

        total: {
            type: Number,
            required: true,
            min: 0
        },

        status: {
            type: String,
            enum: [
                'PENDING_PAYMENT',
                'CONFIRMED',
                'CANCEL_REQUESTED',
                'CANCELLED_BY_CUSTOMER',
                'CANCELLED_BY_OPERATOR',
                'COMPLETED',
                'NO_SHOW',
                'REFUNDED'
            ],
            default: 'PENDING_PAYMENT',
            index: true
        },

        passengerName: {
            type: String,
            required: true,
            trim: true
        },

        passengerPhone: {
            type: String,
            required: true,
            trim: true
        },

        passengerEmail: {
            type: String,
            trim: true,
            lowercase: true,
            default: null
        },

        customerNote: {
            type: String,
            default: ''
        },

        cancelReason: {
            type: String,
            default: ''
        },

        cancelResponse: {
            type: String,
            default: ''
        },

        payment_transactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transaction',
            default: null
        },

        payment_amount: {
            type: Number,
            default: 0,
            min: 0
        },

        payment_status: {
            type: String,
            enum: ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED', 'CANCELLED'],
            default: 'PENDING'
        },

        payment_paymentType: {
            type: String,
            default: null
        },

        isReminder: {
            type: Boolean,
            default: false
        },

        expiresAt: {
            type: Date,
            default: null
        },

        confirmedAt: {
            type: Date,
            default: null
        },

        cancelledAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        collection: 'bookings'
    }
);

module.exports = mongoose.model('Booking', bookingSchema);