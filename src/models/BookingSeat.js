
const mongoose = require('mongoose');

const bookingSeatSchema = new mongoose.Schema(
    {
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: true,
            index: true
        },

        seatCode: {
            type: String,
            required: true,
            trim: true
        },

        seatType: {
            type: String,
            required: true,
            trim: true
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        discount: {
            type: Number,
            default: 0,
            min: 0
        },

        finalPrice: {
            type: Number,
            default: 0,
            min: 0
        },

        passengerName: {
            type: String,
            trim: true,
            default: null
        }
    },
    {
        timestamps: true,
        collection: 'booking_seats_embedded'
    }
);

module.exports = mongoose.model('BookingSeat', bookingSeatSchema);