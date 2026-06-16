const mongoose = require('mongoose');

const partnerInformationSchema = new mongoose.Schema(
    {
        accountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            unique: true
        },

        operatorName: {
            type: String,
            required: true,
            trim: true
        },

        operatorPhone: {
            type: String,
            trim: true
        },

        description: {
            type: String,
            default: ''
        },

        amenities: {
            type: [String],
            default: []
        },

        policies: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        profilePicture: {
            type: String,
            default: null
        },

        coverImage: {
            type: String,
            default: null
        },

        bankName: {
            type: String,
            trim: true
        },

        bankAccountName: {
            type: String,
            trim: true
        },

        bankNumber: {
            type: String,
            trim: true
        },

        bankBranch: {
            type: String,
            trim: true
        },

        sepayVa: {
            type: String,
            trim: true
        },

        sepayKeyEncrypted: {
            type: String,
            select: false
        },

        businessLicense: {
            type: String,
            default: null
        },

        taxCode: {
            type: String,
            trim: true,
            default: null
        },

        isVerified: {
            type: Boolean,
            default: false
        },

        verifiedAt: {
            type: Date,
            default: null
        },

        ratingAvg: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },

        totalReviews: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true,
        collection: 'partner_information'
    }
);

module.exports = mongoose.model('PartnerInformation', partnerInformationSchema);
