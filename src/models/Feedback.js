const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
    {
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: true,
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
    { bookingId: 1, customerId: 1 },
    { unique: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);