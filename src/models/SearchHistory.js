const mongoose = require("mongoose");

const searchHistorySchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            required: true,
            index: true,
        },

        departureLocation: {
            type: String,
            required: true,
            trim: true,
        },

        arrivalLocation: {
            type: String,
            required: true,
            trim: true,
        },

        departureDate: {
            type: Date,
            required: true,
        },

        searchedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
        collection: "search_histories",
    }
);

searchHistorySchema.index({
    customerId: 1,
    searchedAt: -1,
});

module.exports = mongoose.model("SearchHistory", searchHistorySchema);