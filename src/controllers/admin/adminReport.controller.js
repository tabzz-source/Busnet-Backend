const reportService = require('../../services/adminReport.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

const getReports = asyncHandler(async (req, res) => {
    const { status, targetType, page, limit } = req.query;
    const result = await reportService.getReports({ status, targetType, page, limit });

    return successResponse(res, 200, 'Report list fetched successfully', result);
});

const getReportDetail = asyncHandler(async (req, res) => {
    const result = await reportService.getReportDetail(req.params.id);

    return successResponse(res, 200, 'Report detail fetched successfully', result);
});

const resolveReport = asyncHandler(async (req, res) => {
    const result = await reportService.resolveReport(req.params.id, req.body, req.user._id);

    return successResponse(res, 200, `Report ${result.status.toLowerCase()} successfully`, result);
});

module.exports = {
    getReports,
    getReportDetail,
    resolveReport
};
