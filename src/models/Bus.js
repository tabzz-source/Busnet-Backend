// Bus Model

const mongoose = require('mongoose');

const busSchema = new mongoose.Schema(
    {
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            index: true
        },

        busName: {
            type: String,
            required: true,
            trim: true
        },

        licensePlate: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        },

        busType: {
            type: String,
            required: true,
            trim: true
        },

        totalSeats: {
            type: Number,
            required: true,
            min: 1
        },

        description: {
            type: String,
            default: ''
        },

        images: {
            type: [String],
            default: []
        },

        amenities: {
            type: [String],
            default: []
        },

        status: {
            type: String,
            enum: ['ACTIVE', 'MAINTENANCE', 'INACTIVE'],
            default: 'ACTIVE',
            index: true
        },

        isActive: {
            type: Boolean,
            default: true
        },

        seatLayout_totalRows: {
            type: Number,
            required: true,
            min: 1
        },

        seatLayout_totalColumns: {
            type: Number,
            required: true,
            min: 1
        },

        seatLayout_totalFloors: {
            type: Number,
            default: 1,
            min: 1
        }
    },
    {
        timestamps: true,
        collection: 'buses'
    }
);

module.exports = mongoose.model('Bus', busSchema);