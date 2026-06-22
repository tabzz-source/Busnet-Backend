const accountService = require('../../services/adminAccount.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

const getCustomers = asyncHandler(async (req, res) => {
    const { status, search, page, limit } = req.query;
    const result = await accountService.getCustomers({ status, search, page, limit });

    return successResponse(res, 200, 'Customer list fetched successfully', result);
});

const getCustomerDetail = asyncHandler(async (req, res) => {
    const result = await accountService.getCustomerDetail(req.params.id);

    return successResponse(res, 200, 'Customer detail fetched successfully', result);
});

const updateCustomerStatus = asyncHandler(async (req, res) => {
    const result = await accountService.updateCustomerStatus(req.params.id, req.body, req.user._id);
    const action = result.status === 'ACTIVE' ? 'enabled' : 'disabled';

    return successResponse(res, 200, `Customer account ${action} successfully`, result);
});

const deleteCustomer = asyncHandler(async (req, res) => {
    const result = await accountService.deleteCustomer(req.params.id);

    return successResponse(res, 200, result.message);
});

module.exports = {
    getCustomers,
    getCustomerDetail,
    updateCustomerStatus,
    deleteCustomer
};
