const Transaction = require("../models/Transaction");
const Account = require("../models/Account");
const PartnerInformation = require("../models/PartnerInformation");
const PartnerSubscription = require("../models/PartnerSubscription");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const emailService = require("../services/email.service");
const bookingService = require("../services/booking.service");
const asyncHandler = require("../utils/asyncHandler");
const { successResponse } = require("../utils/response");
const AppError = require("../utils/AppError");

/**
 * Extract transactionId from SePay transaction description
 * @param {string} content Payment content description
 * @returns {string|null} transactionId (24-char ObjectId) or null
 */
const extractTransactionId = (content) => {
  if (!content) return null;

  // 1. Try matching with flexible separators: "BUSNET SUB <ObjectId>", "BUSNET_SUB_<ObjectId>", "BUSNET-SUB-<ObjectId>", "BUSNETSUB<ObjectId>", etc.
  let match = content.match(/BUSNET[_\s-]*SUB[_\s-:]*([0-9a-fA-F]{24})/i);
  if (match) return match[1];

  // 2. Fallback: Search for any 24-character hex word in the payment description
  match = content.match(/\b([0-9a-fA-F]{24})\b/);
  if (match) return match[1];

  return null;
};

/**
 * POST /api/sepay/webhook
 * Receives callback webhook from SePay on account balance change
 */
const handleWebhook = asyncHandler(async (req, res) => {
  const {
    id,
    gateway,
    transactionDate,
    accountNumber,
    subAccount,
    transferType,
    transferAmount,
    content,
    referenceCode,
    description,
  } = req.body;

  console.log(
    `[SePay Webhook] Received transaction callback ID: ${id}, Content: "${content}", Amount: ${transferAmount}`,
  );

  // 1. Extract transaction ID
  const searchContent = content || description || "";
  const transactionId = extractTransactionId(searchContent);
  if (!transactionId) {
    const bookingPaymentResult =
      await bookingService.processSepayBookingPayment(
        req.body,
        getAuthenticatedSepayPartner(req),
      );

    if (bookingPaymentResult.handled) {
      return successResponse(
        res,
        200,
        bookingPaymentResult.message,
        bookingPaymentResult.data,
      );
    }

    console.warn(
      `[SePay Webhook] No valid BusNet transaction reference found in payment description.`,
    );
    return res.status(200).json({
      success: false,
      message: "Acknowledged: No valid BusNet transaction reference found",
    });
  }

  // 2. Find Transaction in Database
  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    console.error(
      `[SePay Webhook] Transaction ${transactionId} not found in database.`,
    );
    // Return 200 OK to SePay to acknowledge receipt, preventing retries for incorrect/stale IDs
    return res
      .status(200)
      .json({
        success: false,
        message: "Acknowledged: Transaction ID not found in database",
      });
  }

  if (transaction.transactionType === "BOOKING_PAYMENT") {
    const bookingPaymentResult = await bookingService.processSepayBookingPayment(
      {
        ...req.body,
        code: transaction.code,
        content: content || transaction.content,
        description: description || transaction.description,
      },
      getAuthenticatedSepayPartner(req),
    );

    return successResponse(
      res,
      200,
      bookingPaymentResult.message,
      bookingPaymentResult.data,
    );
  }

  // 3. If transaction is already successful
  if (transaction.status === "SUCCESS") {
    console.log(
      `[SePay Webhook] Transaction ${transactionId} has already been processed successfully.`,
    );
    return successResponse(
      res,
      200,
      "Transaction has already been processed.",
      { transactionId },
    );
  }

  // 4. Ensure incoming transfer (cash in: "in")
  if (transferType && transferType.toLowerCase() !== "in") {
    console.warn(
      `[SePay Webhook] Transaction is not an incoming payment (transferType: ${transferType})`,
    );
    return res
      .status(200)
      .json({
        success: false,
        message: "Acknowledged: Not an incoming payment",
      });
  }

  // 5. Ensure matching transfer amount
  if (transferAmount < transaction.amount) {
    console.error(
      `[SePay Webhook] Transaction ${transactionId} has insufficient payment. Required: ${transaction.amount}, Received: ${transferAmount}`,
    );
    transaction.status = "FAILED";
    transaction.description = `Insufficient payment amount. Required: ${transaction.amount}, Received: ${transferAmount}`;
    await transaction.save();
    return res
      .status(200)
      .json({
        success: false,
        message: "Acknowledged: Insufficient payment amount",
      });
  }

  // 6. Update Transaction details to success
  transaction.status = "SUCCESS";
  transaction.sepayTransactionId = String(id);
  transaction.gateway = gateway || "SEPAY";
  transaction.transactionDate = transactionDate
    ? new Date(transactionDate)
    : new Date();
  transaction.accountNumber = accountNumber;
  transaction.subAccount = subAccount;
  transaction.transferAmount = transferAmount;
  transaction.transferType = transferType;
  transaction.referenceCode = referenceCode;
  await transaction.save();

  // 7. Perform activation based on transaction type
  if (transaction.transactionType === 'SUBSCRIPTION_PAYMENT') {
      const accountId = transaction.partnerId;
      let subscriptionId = transaction.subscriptionId;

      if (!accountId) {
          console.error(`[SePay Webhook] Transaction ${transactionId} has no partnerId.`);
          return res.status(200).json({ success: false, message: 'Acknowledged: No partner linked to transaction' });
      }

      // A. Activate Partner Account
      const account = await Account.findById(accountId);
      if (account) {
          account.status = 'ACTIVE';
          account.isEmailVerified = true;
          await account.save();
          console.log(`[SePay Webhook] Activated Account status to ACTIVE for ${account.email}`);
      }

      // B. Update PartnerInformation verification
      const partnerInfo = await PartnerInformation.findOne({ accountId });
      if (partnerInfo) {
          partnerInfo.isVerified = true;
          partnerInfo.verifiedAt = new Date();
          await partnerInfo.save();
      }

      // C. Handle subscription (create new or renew existing)
      // Money was already received and the transaction is marked SUCCESS above
      // either way — but a plan that was deactivated/deleted between checkout
      // and payment confirmation should not silently activate a subscription
      // against it. Flag it for manual review instead of proceeding blind.
      if (!subscriptionId) {
          // New registration: create PartnerSubscription
          const planId = (transaction.metadata && transaction.metadata.planId) || (partnerInfo && partnerInfo.selectedPlanId);
          const plan = await SubscriptionPlan.findById(planId);

          if (!plan || plan.status !== 'ACTIVE') {
              console.error(`[SePay Webhook] Transaction ${transactionId} paid for plan ${planId}, but that plan is ${plan ? plan.status : 'missing'} — NOT creating a subscription. Needs manual review.`);
          } else {
              const durationDays = plan.durationDays || 30;

              const subscription = await PartnerSubscription.create({
                  partnerId: accountId,
                  planId: planId,
                  subscriptionDate: new Date(),
                  expirationDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
                  subscriptionStatus: 'ACTIVE'
              });
              subscriptionId = subscription._id;

          // Clear temporary field now that subscription is active
          if (partnerInfo) {
              partnerInfo.selectedPlanId = null;
              await partnerInfo.save();
          }

          console.log(`[SePay Webhook] Created PartnerSubscription with status ACTIVE`);
      } else {
          // Existing subscription renewal
          const subscription = await PartnerSubscription.findById(subscriptionId);
          if (subscription) {
              const plan = await SubscriptionPlan.findById(subscription.planId);
              if (!plan || plan.status !== 'ACTIVE') {
                  console.error(`[SePay Webhook] Transaction ${transactionId} renewal payment received, but plan ${subscription.planId} is ${plan ? plan.status : 'missing'} — NOT renewing. Needs manual review.`);
              } else {
                  const durationDays = plan.durationDays || 30;
                  subscription.subscriptionStatus = 'ACTIVE';
                  subscription.subscriptionDate = new Date();
                  subscription.expirationDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
                  await subscription.save();
                  console.log(`[SePay Webhook] Renewed Subscription plan ${plan.planName}, expiration: ${subscription.expirationDate.toISOString()}`);
              }
          }
      }
    }

      // D. Send Partner Welcome Email
      if (account && partnerInfo) {
          const partnerLoginUrl = process.env.PARTNER_DASHBOARD_LOGIN_URL || 'http://localhost:5173/login';
          emailService.sendPartnerWelcomeEmail(account.email, partnerInfo.operatorName, partnerLoginUrl)
              .then(() => console.log(`[SePay Webhook] Welcome email sent successfully to ${account.email}`))
              .catch((err) => console.error(`[SePay Webhook] Error sending welcome email:`, err));
      }
  }

  // C. Send Partner Welcome Email with Dashboard link
  const partnerInfo = await PartnerInformation.findOne({ accountId });
  if (account && partnerInfo) {
    const partnerLoginUrl =
      process.env.PARTNER_DASHBOARD_LOGIN_URL ||
      "http://localhost:5173/login";
    emailService
      .sendPartnerWelcomeEmail(
        account.email,
        partnerInfo.operatorName,
        partnerLoginUrl,
      )
      .then(() =>
        console.log(
          `[SePay Webhook] Welcome email sent successfully to ${account.email}`,
        ),
      )
      .catch((err) =>
        console.error(`[SePay Webhook] Error sending welcome email:`, err),
      );
  }

  return successResponse(res, 200, "Payment webhook processed successfully.", {
    transactionId: transaction._id,
  });
});





/**
 * GET /api/partner/subscription/status/:transactionId
 * Allows client to poll the transaction activation status
 */
const getTransactionStatus = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    throw new AppError("Requested transaction not found.", 404);
  }

  return successResponse(
    res,
    200,
    "Transaction status retrieved successfully.",
    {
      transactionId: transaction._id,
      status: transaction.status, // PENDING, SUCCESS, FAILED
      amount: transaction.amount,
    },
  );
});

const getAuthenticatedSepayPartner = (req) => {
  return req.partner || req.partnerInfo || req.sepayPartner || null;
};

module.exports = {
  handleWebhook,
  getTransactionStatus,
};
