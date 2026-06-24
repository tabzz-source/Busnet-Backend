const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const reportService = require('../../services/report.service');

const createReport = asyncHandler(async (req, res) => {
    const accountId = req.user.id;

    const report = await reportService.createReport(accountId, req.body);

    return successResponse(
        res,
        201,
        'Report created successfully',
        {
            report
        }
    );
});

const getMyReports = asyncHandler(async (req, res) => {
    const accountId = req.user.id;

    const result = await reportService.getMyReports(accountId, req.query);

    return successResponse(
        res,
        200,
        'Reports retrieved successfully',
        result
    );
});

const getMyReportDetail = asyncHandler(async (req, res) => {
    const accountId = req.user.id;
    const { id } = req.params;

    const report = await reportService.getMyReportDetail(accountId, id);

    return successResponse(
        res,
        200,
        'Report detail retrieved successfully',
        {
            report
        }
    );
});

module.exports = {
    createReport,
    getMyReports,
    getMyReportDetail
};