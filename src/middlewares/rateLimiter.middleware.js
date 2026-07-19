const rateLimit = require('express-rate-limit');

// Nothing in this codebase rate-limited anything before this — login and
// OTP/code endpoints were wide open to brute-forcing. These are IP-scoped
// (the simplest, dependency-free option) rather than per-account, so they're
// a baseline defense layer, not a replacement for the per-account lockout
// logic that already exists for admin email verification.
//
// Factories, not shared singletons: each role's routes must get their own
// limiter instance (own in-memory bucket). A single shared instance would
// mean hammering e.g. the customer login endpoint from one IP also locks
// that IP out of the admin/partner login endpoints — confirmed this exact
// failure mode while testing before splitting these out.

// Password/credential guessing endpoints.
const createLoginLimiter = () => rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Please try again in a few minutes.' }
});

// OTP/verification-code request + submit endpoints (forgot-password,
// verify-email, verify-otp, resend-code, etc.) — slightly more headroom than
// login since legitimate users retry typos, but still capped.
const createOtpLimiter = () => rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts. Please wait a few minutes before trying again.' }
});

module.exports = { createLoginLimiter, createOtpLimiter };
