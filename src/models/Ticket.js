
const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
    {
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: true,
            index: true
        },

        tripId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Trip',
            required: true,
            index: true
        },

        seatCode: {
            type: String,
            required: true,
            trim: true
        },

        ticketCode: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        qrCode: {
            type: String,
            default: null
        },

        pdfUrl: {
            type: String,
            default: null
        },

        checkInStatus: {
            type: Boolean,
            default: false
        },

        checkedInAt: {
            type: Date,
            default: null
        },

        ticketExpiredAt: {
            type: Date,
            default: null
        },

        issuedAt: {
            type: Date,
            default: Date.now
        },

        status: {
            type: String,
            enum: ['ISSUED', 'CANCELLED', 'EXPIRED', 'USED', 'NO_SHOW'],
            default: 'ISSUED',
            index: true
        }
    },
    {
        timestamps: true,
        collection: 'tickets'
    }
);

module.exports = mongoose.model('Ticket', ticketSchema);