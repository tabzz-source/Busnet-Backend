// src/models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        accountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            index: true
        },
        type: {
            type: String,
            required: true,
            trim: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true
        },
        readAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        collection: 'notifications'
    }
);

notificationSchema.index({ accountId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
