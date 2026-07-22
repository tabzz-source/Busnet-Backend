// Chạy trong mongosh hoặc MongoDB Compass Shell


db.partner_information.updateOne(
  {
    _id: ObjectId("6a39035168648ae2dbb8bd54"),
    accountId: ObjectId("6a39035168648ae2dbb8bd53")
  },
  {
    $set: {
      profilePicture: "https://lh3.googleusercontent.com/a/ACg8ocL_34_1yP8G5nbnxqC0-mm1L67rpHzh3vmgJLiezy3G6q1ajA=s96-c",
      coverImage: null,

      bankName: "VPBank",
      bankCode: "VPB",
      bankNumber: "0822377076",
      bankAccountName: "BUI ANH TUAN",
      bankBranch: "TP.HCM",

      sepayBankCode: "VPB",
      sepayAccountNumber: "0822377076",
      sepayWebhookEnabled: true,
      paymentEnabled: true,
      paymentSetupStatus: "READY",

      taxCode: "TUAN-TEST-001",
      businessLicense: null,

      isVerified: true,
      verifiedAt: new Date("2026-06-23T10:24:38.448Z"),

      ratingAvg: 4.8,
      totalReviews: 12,

      createdAt: new Date("2026-06-23T00:00:00.000Z"),
      updatedAt: new Date("2026-06-23T10:45:51.821Z"),
      __v: 0
    },

    $unset: {
      sepayVa: "",
      sepayKeyEncrypted: "",
      "0822377076": ""
    }
  }
);