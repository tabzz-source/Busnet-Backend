const express = require('express');
const adminProfileController = require('../../controllers/admin/adminProfile.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const upload = require('../../middlewares/uploadMiddleware');
const { ADMIN } = require('../../constants/roles');
const {
    updateProfileValidation,
    changePasswordValidation
} = require('../../validations/profile.validation');

const router = express.Router();

router.use(protect, restrictTo(ADMIN));

router.get('/', adminProfileController.getProfile);
router.patch('/', upload.single('avatar'), updateProfileValidation, validate, adminProfileController.updateProfile);
router.patch('/password', changePasswordValidation, validate, adminProfileController.changePassword);

module.exports = router;
