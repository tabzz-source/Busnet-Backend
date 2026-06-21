const Report = require('../models/Report');
const AppError = require('../utils/AppError');

const createReport = async (accountId, payload) => {
    const { reportType, description, reportImages = [] } = payload;

    const report = await Report.create({
        accountId,
        reportType,
        description,
        reportImages,
        isResponse: false,
        responseDescription: '',
        status: 'PENDING'
    });

    return report;
};

const getMyReports = async (accountId, query = {}) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const filter = {
        accountId
    };

    if (query.reportType) {
        filter.reportType = query.reportType;
    }

    if (query.status) {
        filter.status = query.status;
    }

    const [reports, total] = await Promise.all([
        Report.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Report.countDocuments(filter)
    ]);

    return {
        reports,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

const getMyReportDetail = async (accountId, reportId) => {
    const report = await Report.findOne({
        _id: reportId,
        accountId
    }).lean();

    if (!report) {
        throw new AppError('Report not found', 404);
    }

    return report;
};

module.exports = {
    createReport,
    getMyReports,
    getMyReportDetail
};