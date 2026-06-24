const partnerService = require('../../services/partner.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

const getPartners = asyncHandler(async (req, res) => {
    const { status, search, page, limit } = req.query;
    const result = await partnerService.getPartners({ status, search, page, limit });

    return successResponse(res, 200, 'Partner list fetched successfully', result);
});

const getPartnerDetail = asyncHandler(async (req, res) => {
    const result = await partnerService.getPartnerDetail(req.params.id);

    return successResponse(res, 200, 'Partner detail fetched successfully', result);
});

const updatePartnerStatus = asyncHandler(async (req, res) => {
    const result = await partnerService.updatePartnerStatus(req.params.id, req.body, req.user._id);
    const action = result.status === 'ACTIVE' ? 'enabled' : 'disabled';

    return successResponse(res, 200, `Partner account ${action} successfully`, result);
});

const deletePartner = asyncHandler(async (req, res) => {
    const result = await partnerService.deletePartner(req.params.id);

    return successResponse(res, 200, result.message);
});

// ============================
// PENDING REGISTRATION MANAGEMENT
// ============================

const getPendingRegistrations = asyncHandler(async (req, res) => {
    const { status, search, page, limit } = req.query;
    const result = await partnerService.getPendingRegistrations({ status, search, page, limit });

    return successResponse(res, 200, 'Pending registrations fetched successfully', result);
});

const reviewPendingRegistration = asyncHandler(async (req, res) => {
    const { status, rejectionReason } = req.body;
    const result = await partnerService.reviewPendingRegistration(req.params.id, { status, rejectionReason }, req.user._id);

    const action = status === 'APPROVED' ? 'approved' : 'rejected';
    return successResponse(res, 200, `Registration ${action} successfully`, result);
});

module.exports = {
    getPartners,
    getPartnerDetail,
    updatePartnerStatus,
    deletePartner,
    getPendingRegistrations,
    reviewPendingRegistration
};
