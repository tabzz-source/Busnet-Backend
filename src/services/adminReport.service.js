const Report = require('../models/Report');
const AppError = require('../utils/AppError');

const getReports = async ({ status, targetType, page = 1, limit = 10 }) => {
    const filter = {};

    if (status) {
        filter.status = status;
    }

    if (targetType) {
        filter.reportType = targetType;
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
    const skip = (pageNum - 1) * limitNum;

    const [rawReports, total] = await Promise.all([
        Report.find(filter)
            .populate('accountId', '_id fullName email username phone profilePicture')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Report.countDocuments(filter)
    ]);

    const reports = rawReports.map((r) => ({
        _id: r._id,
        reporterId: r.accountId,
        targetType: r.reportType,
        targetId: r._id.toString(),
        reason: r.description,
        description: r.responseDescription || '',
        status: r.status,
        evidence: r.reportImages || [],
        resolvedAt: r.resolvedAt,
        adminNote: r.adminNote,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
    }));

    return {
        reports,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1
        }
    };
};

const getReportDetail = async (reportId) => {
    const r = await Report.findById(reportId)
        .populate('accountId', '_id fullName email username phone profilePicture')
        .populate('resolvedBy', '_id fullName email')
        .lean();

    if (!r) {
        throw new AppError('Report not found', 404);
    }

    return {
        _id: r._id,
        reporterId: r.accountId,
        targetType: r.reportType,
        targetId: r._id.toString(),
        reason: r.description,
        description: r.responseDescription || '',
        status: r.status,
        evidence: r.reportImages || [],
        resolvedAt: r.resolvedAt,
        adminNote: r.adminNote,
        resolvedBy: r.resolvedBy || null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
    };
};

const resolveReport = async (reportId, { status, adminNote }, adminId) => {
    const report = await Report.findById(reportId);

    if (!report) {
        throw new AppError('Report not found', 404);
    }

    if (report.status !== 'PENDING' && report.status !== 'IN_REVIEW') {
        throw new AppError(`Report has already been ${report.status.toLowerCase()}`, 409);
    }

    if (!['RESOLVED', 'DISMISSED', 'REJECTED'].includes(status)) {
        throw new AppError('Status must be RESOLVED, DISMISSED, or REJECTED', 400);
    }

    report.status = status;
    report.adminNote = adminNote || null;
    report.isResponse = true;
    report.responseDescription = adminNote || '';
    report.resolvedBy = adminId;
    report.resolvedAt = new Date();
    await report.save();

    return report;
};

module.exports = {
    getReports,
    getReportDetail,
    resolveReport
};
