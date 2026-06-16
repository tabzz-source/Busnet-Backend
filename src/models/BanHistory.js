const mongoose = require("mongoose");

const { Schema, model } = mongoose;

// =========================
// ENUMS
// =========================

const BanType = {
    TEMPORARY: "TEMPORARY",
    PERMANENT: "PERMANENT",
};

const BanStatus = {
    ACTIVE: "ACTIVE",
    EXPIRED: "EXPIRED",
    REVOKED: "REVOKED",
};

// =========================
// SCHEMA
// =========================

const banHistorySchema = new Schema(
    {
        accountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            required: true,
            index: true,
        },

        bannedBy: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            default: null,
        },

        banCounts: {
            type: Number,
            default: 1,
            min: 1,
        },

        type: {
            type: String,
            enum: Object.values(BanType),
            required: true,
        },

        reason: {
            type: String,
            trim: true,
            default: "",
        },

        banDescription: {
            type: String,
            default: "",
        },

        startedAt: {
            type: Date,
            default: Date.now,
        },

        expiredAt: {
            type: Date,
            default: null,
        },

        unbannedAt: {
            type: Date,
            default: null,
        },

        status: {
            type: String,
            enum: Object.values(BanStatus),
            default: BanStatus.ACTIVE,
        },
    },
    {
        collection: "ban_histories",
        timestamps: true,
    }
);

const BanHistory = model("BanHistory", banHistorySchema);

module.exports = BanHistory;
module.exports.BanType = BanType;
module.exports.BanStatus = BanStatus;
