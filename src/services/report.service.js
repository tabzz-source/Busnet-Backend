const Report = require('../models/Report');
const AppError = require('../utils/AppError');

// Which model a targetId belongs to, derived server-side from reportType
// rather than trusted from the client — keeps a mismatched targetId/reportType
// pair from ever pointing refPath at the wrong collection.
const TARGET_MODEL_BY_REPORT_TYPE = {
    TRIP: 'Trip',
    BOOKING: 'Booking',
    OPERATOR: 'Account',
    PAYMENT: 'Transaction'
};

const createReport = async (accountId, payload) => {
    const { reportType, description, reportImages = [], targetId } = payload;
    const targetModel = targetId ? TARGET_MODEL_BY_REPORT_TYPE[reportType] || null : null;

    const report = await Report.create({
        accountId,
        reportType,
        description,
        reportImages,
        targetModel,
        targetRefId: targetModel ? targetId : null,
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