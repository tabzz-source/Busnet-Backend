const bookingService = require("../services/booking.service");

const handleSepayBookingWebhook = async (req, res, next) => {
  try {
    console.log("\n================ [SEPAY BOOKING WEBHOOK RECEIVED] ================");
    console.log("[BOOKING WEBHOOK][BODY]", req.body);
    console.log("[BOOKING WEBHOOK][AUTH PARTNER]", {
      accountId: req.authenticatedSepayPartner?.accountId
        ? String(req.authenticatedSepayPartner.accountId)
        : null,
      operatorName: req.authenticatedSepayPartner?.operatorName || null,
    });

    const result = await bookingService.processSepayBookingPayment(
      req.body,
      req.authenticatedSepayPartner
    );

    console.log("[BOOKING WEBHOOK][RESULT]", result);
    console.log("================ [SEPAY BOOKING WEBHOOK DONE] ================\n");

    return res.status(200).json({
      success: true,
      message: result.message || "Booking webhook received",
      data: result.data || null,
    });
  } catch (error) {
    console.error("[BOOKING WEBHOOK][ERROR]", {
      message: error.message,
      stack: error.stack,
    });

    return next(error);
  }
};

module.exports = {
  handleSepayBookingWebhook,
};