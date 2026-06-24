const PartnerInformation = require("../models/PartnerInformation");

const verifySepayBookingWebhook = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";

    console.log("\n================ [SEPAY BOOKING WEBHOOK AUTH] ================");
    console.log("[BOOKING AUTH][RAW HEADERS]", {
      authorization,
      contentType: req.headers["content-type"],
      userAgent: req.headers["user-agent"],
    });

    // SePay gửi dạng:
    // Authorization: Apikey YOUR_API_KEY
    const match = authorization.match(/^Apikey\s+(.+)$/i);
    const receivedApiKey = match ? match[1].trim() : "";

    console.log("[BOOKING AUTH][PARSED]", {
      authPrefixValid: !!match,
      hasReceivedApiKey: !!receivedApiKey,
      receivedApiKeyLength: receivedApiKey.length,
      receivedApiKeyStart: receivedApiKey ? receivedApiKey.slice(0, 8) : null,
      receivedApiKeyEnd: receivedApiKey ? receivedApiKey.slice(-8) : null,
    });

    if (!receivedApiKey) {
      return res.status(401).json({
        success: false,
        message: "Missing SePay booking API key",
      });
    }

    const partnerInfo = await PartnerInformation.findOne({
      sepayKeyEncrypted: receivedApiKey,
      paymentEnabled: true,
      sepayWebhookEnabled: true,
    }).lean();

    console.log("[BOOKING AUTH][PARTNER INFO RESULT]", {
      found: !!partnerInfo,
      partnerInformationId: partnerInfo?._id ? String(partnerInfo._id) : null,
      accountId: partnerInfo?.accountId ? String(partnerInfo.accountId) : null,
      operatorName: partnerInfo?.operatorName || null,
      paymentEnabled: partnerInfo?.paymentEnabled,
      sepayWebhookEnabled: partnerInfo?.sepayWebhookEnabled,
      paymentSetupStatus: partnerInfo?.paymentSetupStatus || null,
    });

    if (!partnerInfo) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed: Booking SePay API Key mismatch",
      });
    }

    req.authenticatedSepayPartner = {
      partnerInformationId: partnerInfo._id,
      accountId: partnerInfo.accountId,
      partnerId: partnerInfo.accountId,
      operatorName: partnerInfo.operatorName,
      raw: partnerInfo,
    };

    console.log("[BOOKING AUTH][PASSED]", {
      accountId: String(partnerInfo.accountId),
      operatorName: partnerInfo.operatorName,
    });
    console.log("================ [SEPAY BOOKING WEBHOOK AUTH DONE] ================\n");

    return next();
  } catch (error) {
    console.error("[BOOKING AUTH][ERROR]", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: "Booking webhook authentication error",
    });
  }
};

module.exports = verifySepayBookingWebhook;