const express = require('express');
const adminPartnerController = require('../../controllers/admin/adminPartner.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { ADMIN } = require('../../constants/roles');
const {
    partnerIdValidation,
    updatePartnerStatusValidation
} = require('../../validations/partner.validation');

const router = express.Router();

router.use(protect, restrictTo(ADMIN));

router.get('/', adminPartnerController.getPartners);
router.get('/:id', partnerIdValidation, validate, adminPartnerController.getPartnerDetail);
router.patch('/:id/status', updatePartnerStatusValidation, validate, adminPartnerController.updatePartnerStatus);
router.delete('/:id', partnerIdValidation, validate, adminPartnerController.deletePartner);

module.exports = router;
