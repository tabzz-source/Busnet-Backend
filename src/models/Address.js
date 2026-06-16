const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
    {
        accountId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            index: true
        },

        type: {
            type: String,
            enum: ['HOME', 'OFFICE', 'BUSINESS', 'OTHER'],
            default: 'OTHER'
        },

        address: {
            type: String,
            required: true,
            trim: true
        },

        ward: {
            type: String,
            trim: true
        },

        wardName: {
            type: String,
            trim: true
        },

        district: {
            type: String,
            trim: true
        },

        districtName: {
            type: String,
            trim: true
        },

        province: {
            type: String,
            trim: true
        },

        provinceName: {
            type: String,
            trim: true
        },

        isDefault: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
        collection: 'addresses'
    }
);

module.exports = mongoose.model('Address', addressSchema);
