const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            trim: true,
            unique: true,
            sparse: true
        },

        email: {
            type: String,
            trim: true,
            lowercase: true,
            unique: true,
            sparse: true
        },

        phone: {
            type: String,
            trim: true,
            unique: true,
            sparse: true
        },

        passwordHash: {
            type: String,
            select: false
        },

        role: {
            type: String,
            enum: ['CUSTOMER', 'PARTNER', 'ADMIN'],
            default: 'CUSTOMER',
            required: true
        },

        status: {
            type: String,
            enum: ['UNVERIFIED', 'ACTIVE', 'DELETED', 'BANNED', 'PENDING_APPROVAL'],
            default: 'UNVERIFIED'
        },

        fullName: {
            type: String,
            trim: true
        },

        gender: {
            type: String,
            enum: ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'],
            default: 'UNKNOWN'
        },

        dob: {
            type: Date
        },

        profilePicture: {
            type: String,
            default: null
        },

        isOAuthUser: {
            type: Boolean,
            default: false
        },

        googleId: {
            type: String,
            unique: true,
            sparse: true
        },

        isEmailVerified: {
            type: Boolean,
            default: false
        },

        isPhoneVerified: {
            type: Boolean,
            default: false
        },

        banCounts: {
            type: Number,
            default: 0
        },

        isAutoPublishBlog: {
            type: Boolean,
            default: false
        },
        deletedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        collection: 'accounts'
    }
);

module.exports = mongoose.model('Account', accountSchema);
