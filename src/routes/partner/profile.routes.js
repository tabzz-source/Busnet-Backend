const express = require('express');
const partnerProfileController = require('../../controllers/partner/partnerProfile.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const upload = require('../../middlewares/uploadMiddleware');
const validate = require('../../middlewares/validate.middleware');
const { PARTNER } = require('../../constants/roles');
const { updatePartnerProfileValidation } = require('../../validations/partner.validation');
const router = express.Router();

// Get current partner's profile (protected route)
router.get('/me', authenticate, restrictTo(PARTNER), partnerProfileController.getProfile);
router.patch(
    '/me',
    authenticate,
    restrictTo(PARTNER),
    upload.fields([
        { name: 'profilePicture', maxCount: 1 },
        { name: 'coverImage', maxCount: 1 }
    ]),
    updatePartnerProfileValidation,
    validate,
    partnerProfileController.updateProfile
);

module.exports = router;
