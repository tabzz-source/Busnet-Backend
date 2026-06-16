
const mongoose = require('mongoose');

const busSeatSchema = new mongoose.Schema(
    {
        busId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Bus',
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
            enum: ['SEAT', 'SLEEPER', 'LIMOUSINE_SEAT', 'LIMOUSINE_SLEEPER'],
            required: true,
            trim: true
        },

        floor: {
            type: Number,
            default: 1,
            min: 1
        },

        row: {
            type: Number,
            required: true,
            min: 1
        },

        column: {
            type: Number,
            required: true,
            min: 1
        },

        isActive: {
            type: Boolean,
            default: true
        },

        priceModifier: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true,
        collection: 'bus_seats_embedded'
    }
);

busSeatSchema.index({ busId: 1, seatCode: 1 }, { unique: true });

module.exports = mongoose.model('BusSeat', busSeatSchema);