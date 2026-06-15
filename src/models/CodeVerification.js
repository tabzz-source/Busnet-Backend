const mongoose = require('mongoose');

const codeVerificationSchema = new mongoose.Schema(
    {
        accountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            default: null,
            index: true
        },

        target: {
            type: String,
            trim: true,
            required: true
        },

        targetType: {
            type: String,
            enum: ['EMAIL', 'PHONE'],
            required: true
        },

        type: {
            type: String,
            enum: ['REGISTER', 'LOGIN', 'RESET_PASSWORD', 'VERIFY_EMAIL', 'VERIFY_PHONE'],
            required: true
        },

        codeHash: {
            type: String,
            required: true,
            select: false
        },

        expiredAt: {
            type: Date,
            required: true
        },

        used: {
            type: Boolean,
            default: false
        },

        usedAt: {
            type: Date,
            default: null
        },

        attemptCount: {
            type: Number,
            default: 0,
            min: 0
        },

        maxAttempts: {
            type: Number,
            default: 5
        }
    },
    {
        timestamps: true,
        collection: 'code_verifications'
    }
);

codeVerificationSchema.index({ expiredAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('CodeVerification', codeVerificationSchema);
