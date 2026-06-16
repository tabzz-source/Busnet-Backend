
const mongoose = require('mongoose');

const ticketPriceSchema = new mongoose.Schema(
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

        effectiveFrom: {
            type: Date,
            required: true
        },

        effectiveTo: {
            type: Date,
            default: null
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true,
        collection: 'ticket_prices'
    }
);

ticketPriceSchema.index({ scheduleId: 1, seatType: 1, effectiveFrom: 1 });

module.exports = mongoose.model('TicketPrice', ticketPriceSchema);