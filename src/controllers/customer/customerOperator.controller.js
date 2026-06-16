const operatorService = require('../../services/operator.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

/**
 * GET /api/customer/operators
 * View list of verified operators for guests & customers
 */
const getOperators = asyncHandler(async (req, res) => {
    const result = await operatorService.getVerifiedOperators(req.query);
    return successResponse(res, 200, 'Operators retrieved successfully', result);
});

/**
 * GET /api/customer/operators/:id
 * View operator detail by accountId for guests & customers
 */
const getOperatorDetail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await operatorService.getOperatorDetail(id);
    return successResponse(res, 200, 'Operator detail retrieved successfully', result);
});

module.exports = {
    getOperators,
    getOperatorDetail
};
