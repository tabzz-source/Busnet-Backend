
const mongoose = require('mongoose');

const tripSeatSchema = new mongoose.Schema(
    {
        seatCode: {
            type: String,
            required: true,
            trim: true
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        status: {
            type: String,
            enum: ['AVAILABLE', 'HELD', 'BOOKED', 'CANCELLED', 'LOCKED'],
            default: 'AVAILABLE'
        },

        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            default: null
        },

        ticketId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Ticket',
            default: null
        },

        lockedUntil: {
            type: Date,
            default: null
        }
    },
    {
        _id: false
    }
);

const tripSchema = new mongoose.Schema(
    {
        scheduleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Schedule',
            required: true,
            index: true
        },

        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            index: true
        },

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

        tripCode: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        departureDate: {
            type: Date,
            required: true,
            index: true
        },

        actualDepartureTime: {
            type: Number,
            required: true,
            min: 0,
            max: 1439
        },

        actualArrivalTime: {
            type: Number,
            default: null,
            min: 0,
            max: 1439
        },

        totalSeats: {
            type: Number,
            required: true,
            min: 1
        },

        availableSeats: {
            type: Number,
            required: true,
            min: 0
        },

        bookedSeats: {
            type: Number,
            default: 0,
            min: 0
        },

        heldSeats: {
            type: Number,
            default: 0,
            min: 0
        },

        priceOverride: {
            type: Number,
            default: null,
            min: 0
        },

        seats: {
            type: [tripSeatSchema],
            default: []
        },

        status: {
            type: String,
            enum: ['OPEN', 'CLOSED', 'DELAYED', 'CANCELLED', 'COMPLETED'],
            default: 'OPEN',
            index: true
        }
    },
    {
        timestamps: true,
        collection: 'trips'
    }
);

tripSchema.index({ scheduleId: 1, departureDate: 1 }, { unique: true });
tripSchema.index({ routeId: 1, departureDate: 1, status: 1 });
tripSchema.index({ partnerId: 1, departureDate: 1 });
tripSchema.index({ _id: 1, 'seats.seatCode': 1 });

module.exports = mongoose.model('Trip', tripSchema);