const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
    {
        accountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            index: true
        },

        reportType: {
            type: String,
            enum: ['TRIP', 'BOOKING', 'OPERATOR', 'PAYMENT', 'SYSTEM', 'OTHER'],
            required: true,
            trim: true,
            index: true
        },

        // The actual entity being reported (a specific trip/booking/operator/
        // transaction), as opposed to reportType which is just a category.
        // Both optional/nullable — SYSTEM and OTHER reports have no natural
        // target, and older reports predate this field entirely.
        targetModel: {
            type: String,
            enum: ['Trip', 'Booking', 'Account', 'Transaction'],
            default: null
        },

        targetRefId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'targetModel',
            default: null,
            index: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        reportImages: {
            type: [String],
            default: []
        },

        isResponse: {
            type: Boolean,
            default: false
        },

        responseDescription: {
            type: String,
            default: ''
        },

        status: {
            type: String,
            enum: ['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'DISMISSED'],
            default: 'PENDING',
            index: true
        },

        adminNote: {
            type: String,
            default: null
        },

        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            default: null
        },

        resolvedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        collection: 'reports'
    }
);

module.exports = mongoose.model('Report', reportSchema);
