const express = require('express');
const authenticate = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/uploadMiddleware');
const customerProfileController = require('../../controllers/customer/customerProfile.controller');
const { validateChangePassword } = require('../../validations/auth.validation');
const { validateUpdateProfile } = require('../../validations/profile.validation');

const router = express.Router();

router.get('/me', authenticate, customerProfileController.getMyProfile);
router.patch('/change-password', authenticate, validateChangePassword, customerProfileController.changePassword);
router.patch('/me', authenticate, upload.single('profilePicture'), validateUpdateProfile, customerProfileController.updateMyProfile);

module.exports = router;
