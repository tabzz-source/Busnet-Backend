const Report = require('../models/Report');
const Account = require('../models/Account');
const AppError = require('../utils/AppError');
const { sendReportResolvedEmail } = require('./email.service');

// Display-friendly label per target model — whichever field an admin would
// recognize the referenced record by at a glance.
const TARGET_LABEL_FIELD = {
    Trip: 'tripCode',
    Booking: 'bookingCode',
    Account: 'fullName',
    Transaction: 'code'
};

const buildTargetSummary = (r) => {
    if (!r.targetRefId || !r.targetModel) {
        return null;
    }
    const labelField = TARGET_LABEL_FIELD[r.targetModel];
    return {
        model: r.targetModel,
        id: r.targetRefId._id ? r.targetRefId._id.toString() : r.targetRefId.toString(),
        label: (labelField && r.targetRefId[labelField]) || null
    };
};

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

    const [rawReports, total, statusCounts] = await Promise.all([
        Report.find(filter)
            .populate('accountId', '_id fullName email username phone profilePicture')
            .populate('targetRefId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Report.countDocuments(filter),
        // Stat cards summarize every report regardless of the current
        // status/targetType filter or page — grouped once here instead of
        // being derived from the paginated `reports` slice on the frontend.
        Report.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);

    const countByStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
    const stats = {
        pending: (countByStatus.PENDING || 0) + (countByStatus.IN_REVIEW || 0),
        resolved: countByStatus.RESOLVED || 0,
        dismissed: (countByStatus.DISMISSED || 0) + (countByStatus.REJECTED || 0)
    };

    const reports = rawReports.map((r) => ({
        _id: r._id,
        reporterId: r.accountId,
        targetType: r.reportType,
        target: buildTargetSummary(r),
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
        },
        stats
    };
};

const getReportDetail = async (reportId) => {
    const r = await Report.findById(reportId)
        .populate('accountId', '_id fullName email username phone profilePicture')
        .populate('resolvedBy', '_id fullName email')
        .populate('targetRefId')
        .lean();

    if (!r) {
        throw new AppError('Report not found', 404);
    }

    return {
        _id: r._id,
        reporterId: r.accountId,
        targetType: r.reportType,
        target: buildTargetSummary(r),
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

    if (!['RESOLVED', 'DISMISSED'].includes(status)) {
        throw new AppError('Status must be RESOLVED or DISMISSED', 400);
    }

    report.status = status;
    report.adminNote = adminNote || null;
    report.isResponse = true;
    report.responseDescription = adminNote || '';
    report.resolvedBy = adminId;
    report.resolvedAt = new Date();
    // validateModifiedOnly: some legacy reports predate fields that are now
    // required (e.g. reportType/accountId) and don't have them set. A normal
    // save() re-validates the whole document and would block this update on
    // those untouched paths even though we're not changing them.
    await report.save({ validateModifiedOnly: true });

    if (status === 'RESOLVED' && report.accountId) {
        const reporter = await Account.findById(report.accountId).select('email fullName').lean();
        if (reporter?.email) {
            sendReportResolvedEmail(reporter.email, reporter.fullName, report.description, adminNote).catch((err) => {
                console.error('Failed to send report-resolved email:', err.message);
            });
        }
    }

    return report;
};

module.exports = {
    getReports,
    getReportDetail,
    resolveReport
};
