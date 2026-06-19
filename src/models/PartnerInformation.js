const mongoose = require('mongoose');

const partnerInformationSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
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
      default: ""
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
      trim: true,
      default: null
    },

    bankCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null
    },

    bankAccountName: {
      type: String,
      trim: true,
      default: null
    },

    bankNumber: {
      type: String,
      trim: true,
      default: null
    },

    bankBranch: {
      type: String,
      trim: true,
      default: null
    },

    paymentEnabled: {
      type: Boolean,
      default: false
    },

    paymentSetupStatus: {
      type: String,
      enum: ["NOT_CONFIGURED", "PENDING", "READY", "DISABLED"],
      default: "NOT_CONFIGURED"
    },

    sepayVa: {
      type: String,
      trim: true,
      default: null
    },

    sepayAccountNumber: {
      type: String,
      trim: true,
      default: null
    },

    sepayBankCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null
    },

    sepayWebhookEnabled: {
      type: Boolean,
      default: false
    },

    sepayKeyEncrypted: {
      type: String,
      select: false,
      default: null
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
    timestamps: true
  }
);

module.exports = mongoose.model('PartnerInformation', partnerInformationSchema);
