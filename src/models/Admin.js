const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            trim: true,
            unique: true,
            required: true
        },

        email: {
            type: String,
            trim: true,
            lowercase: true,
            unique: true,
            required: true
        },

        passwordHash: {
            type: String,
            required: true,
            select: false
        },

        fullName: {
            type: String,
            trim: true
        },

        role: {
            type: String,
            enum: ['ADMIN'],
            default: 'ADMIN',
            required: true
        },

        status: {
            type: String,
            enum: ['ACTIVE', 'DISABLED'],
            default: 'ACTIVE'
        },

        avatar: {
            type: String,
            default: null
        },

        isEmailVerified: {
            type: Boolean,
            default: false
        },

        lastLoginAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        collection: 'admins'
    }
);

module.exports = mongoose.model('Admin', adminSchema);
