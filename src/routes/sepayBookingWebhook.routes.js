const express = require("express");

const bookingWebhookController = require("../controllers/bookingWebhook.controller");
const verifySepayBookingWebhook = require("../middlewares/verifySepayBookingWebhook.middleware");

const router = express.Router();

router.post(
  "/webhook",
  verifySepayBookingWebhook,
  bookingWebhookController.handleSepayBookingWebhook
);

module.exports = router;