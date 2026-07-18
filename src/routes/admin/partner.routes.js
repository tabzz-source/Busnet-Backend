const express = require('express');
const adminPartnerController = require('../../controllers/admin/adminPartner.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { ADMIN } = require('../../constants/roles');
const { query } = require('express-validator');
const {
    partnerIdValidation,
    updatePartnerStatusValidation
} = require('../../validations/partner.validation');

const router = express.Router();

router.use(protect, restrictTo(ADMIN));

const pageLimitValidation = [
    query('search').optional().trim().isLength({ max: 100 }).withMessage('Search must be at most 100 characters'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];

const getPartnersValidation = [
    query('status')
        .optional()
        .isIn(['UNVERIFIED', 'ACTIVE', 'DELETED', 'BANNED', 'PENDING_APPROVAL', 'DISABLED'])
        .withMessage('Invalid status filter'),
    ...pageLimitValidation
];

const getPendingRegistrationsValidation = [
    query('status')
        .optional()
        .isIn(['PENDING', 'APPROVED', 'REJECTED'])
        .withMessage('Invalid status filter'),
    ...pageLimitValidation
];

// Pending Registration Management
router.get('/pending-registrations', getPendingRegistrationsValidation, validate, adminPartnerController.getPendingRegistrations);
router.patch('/pending-registrations/:id/review', adminPartnerController.reviewPendingRegistration);

// Partner Management
router.get('/', getPartnersValidation, validate, adminPartnerController.getPartners);
router.get('/:id', partnerIdValidation, validate, adminPartnerController.getPartnerDetail);
router.patch('/:id/status', updatePartnerStatusValidation, validate, adminPartnerController.updatePartnerStatus);
router.delete('/:id', partnerIdValidation, validate, adminPartnerController.deletePartner);

module.exports = router;
