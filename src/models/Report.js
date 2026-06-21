// src/models/Report.js
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
            enum: ['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED'],
            default: 'PENDING',
            index: true
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