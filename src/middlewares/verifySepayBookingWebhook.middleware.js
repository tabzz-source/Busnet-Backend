const PartnerInformation = require("../models/PartnerInformation");
const sepayCrypto = require("../utils/sepayCrypto");

const verifySepayBookingWebhook = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";

    console.log("\n================ [SEPAY BOOKING WEBHOOK AUTH] ================");
    console.log("[BOOKING AUTH][RAW HEADERS]", {
      authorization,
      contentType: req.headers["content-type"],
      userAgent: req.headers["user-agent"],
    });
    console.log("[BOOKING AUTH][REQ BODY]", JSON.stringify(req.body, null, 2));

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

    // Bypass check for SePay test webhooks (Gửi thử)
    if (req.body && req.body.code === "SEPAYTEST") {
      console.log("[BOOKING AUTH][TEST BYPASS] Bypassing auth check for SePay test webhook.");
      req.authenticatedSepayPartner = {
        partnerInformationId: null,
        accountId: null,
        partnerId: null,
        operatorName: "SePay Test Partner",
      };
      return next();
    }

    const vaNumber = req.body.subAccount;
    const accNumber = req.body.accountNumber;
    const bookingCode = req.body.code;

    // Step 1: Try finding partner by subAccount (VA) or accountNumber
    let partnerInfo = null;
    if (vaNumber) {
      partnerInfo = await PartnerInformation.findOne({ sepayVa: vaNumber }).select('+sepayKeyEncrypted').lean();
    }
    if (!partnerInfo && accNumber) {
      partnerInfo = await PartnerInformation.findOne({ bankNumber: accNumber }).select('+sepayKeyEncrypted').lean();
    }

    // Step 2: Fallback - find partner via booking code (for SePay API Banking
    // where accountNumber is SePay's VPBank intermediary, not the partner's bank)
    if (!partnerInfo && bookingCode) {
      const Booking = require("../models/Booking");
      const { extractBookingCodeFromContent } = require("../utils/bookingCode");

      let resolvedCode = String(bookingCode || "").trim().toUpperCase();
      if (!resolvedCode || resolvedCode === "null") {
        resolvedCode = extractBookingCodeFromContent(req.body.content) ||
                       extractBookingCodeFromContent(req.body.description);
      }

      if (resolvedCode) {
        const booking = await Booking.findOne({ bookingCode: resolvedCode }).lean();
        if (booking && booking.partnerId) {
          partnerInfo = await PartnerInformation.findOne({ accountId: booking.partnerId }).select('+sepayKeyEncrypted').lean();
          console.log("[BOOKING AUTH][FALLBACK VIA BOOKING CODE]", {
            bookingCode: resolvedCode,
            foundPartner: !!partnerInfo,
            partnerId: partnerInfo?.accountId ? String(partnerInfo.accountId) : null,
          });
        }
      }
    }

    // Step 3: If still no partner, try extracting booking code from content/description
    if (!partnerInfo && !bookingCode) {
      const Booking = require("../models/Booking");
      const { extractBookingCodeFromContent } = require("../utils/bookingCode");

      const resolvedCode = extractBookingCodeFromContent(req.body.content) ||
                           extractBookingCodeFromContent(req.body.description);

      if (resolvedCode) {
        const booking = await Booking.findOne({ bookingCode: resolvedCode }).lean();
        if (booking && booking.partnerId) {
          partnerInfo = await PartnerInformation.findOne({ accountId: booking.partnerId }).select('+sepayKeyEncrypted').lean();
          console.log("[BOOKING AUTH][FALLBACK VIA CONTENT]", {
            bookingCode: resolvedCode,
            foundPartner: !!partnerInfo,
          });
        }
      }
    }

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
        message: "Authentication failed: Partner not found",
      });
    }

    const isPaymentEnabled = partnerInfo.paymentEnabled !== false;
    const isSepayWebhookEnabled = partnerInfo.sepayWebhookEnabled !== false;

    if (!isPaymentEnabled || !isSepayWebhookEnabled) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed: Partner payment or webhook is disabled",
      });
    }

    let decryptedKey = partnerInfo.sepayKeyEncrypted;
    if (decryptedKey && decryptedKey.includes(':')) {
      try {
        const decrypted = sepayCrypto.decrypt(decryptedKey);
        if (decrypted) {
          decryptedKey = decrypted;
        }
      } catch (err) {
        console.error('Failed to decrypt booking fallback key:', err);
      }
    }

    if (!decryptedKey || decryptedKey !== receivedApiKey) {
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