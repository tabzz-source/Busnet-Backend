// src/models/FavouriteOperator.js
const mongoose = require('mongoose');

const favouriteOperatorSchema = new mongoose.Schema(
    {
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
        }
    },
    {
        timestamps: true,
        collection: 'favourite_operators'
    }
);

favouriteOperatorSchema.index(
    { customerId: 1, partnerId: 1 },
    { unique: true }
);

module.exports = mongoose.model('FavouriteOperator', favouriteOperatorSchema);