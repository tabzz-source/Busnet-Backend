// src/models/Feedback.js
const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
    {
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            default: null,
            index: true
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

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },

        review: {
            type: String,
            trim: true,
            default: ''
        },

        reviewImages: {
            type: [String],
            default: []
        },

        type: {
            type: String,
            enum: ['TRIP', 'OPERATOR'],
            default: 'TRIP',
            index: true
        },

        status: {
            type: String,
            enum: ['VISIBLE', 'HIDDEN', 'DELETED'],
            default: 'VISIBLE',
            index: true
        }
    },
    {
        timestamps: true,
        collection: 'feedbacks'
    }
);

feedbackSchema.index(
    { bookingId: 1, customerId: 1, type: 1 },
    {
        unique: true,
        partialFilterExpression: {
            bookingId: { $type: 'objectId' },
            type: 'TRIP'
        }
    }
);

feedbackSchema.index(
    { partnerId: 1, customerId: 1, type: 1 },
    {
        unique: true,
        partialFilterExpression: {
            type: 'OPERATOR'
        }
    }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
