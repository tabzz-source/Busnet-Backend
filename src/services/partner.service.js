const Account = require('../models/Account');
const PartnerInformation = require('../models/PartnerInformation');
const PartnerSubscription = require('../models/PartnerSubscription');
const BanHistory = require('../models/BanHistory');
const AppError = require('../utils/AppError');
const uploadToCloudinary = require('../utils/uploadToCloudinary');
const { PARTNER } = require('../constants/roles');
const emailService = require('./email.service');

const partnerListSelect = '_id username email phone fullName status profilePicture isEmailVerified isPhoneVerified banCounts createdAt updatedAt';
const partnerDetailSelect = `${partnerListSelect} gender dob isAutoPublishBlog`;
const PARTNER_PROFILE_FOLDER = process.env.CLOUDINARY_PARTNER_PROFILE_FOLDER || 'busnet/partners/profiles';
const PARTNER_COVER_FOLDER = process.env.CLOUDINARY_PARTNER_COVER_FOLDER || 'busnet/partners/covers';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ============================
// VIEW PARTNER LIST
// ============================

const getPartners = async ({ status, search, page = 1, limit = 10 }) => {
    const filter = { role: PARTNER, deletedAt: null };

    if (status) {
        filter.status = status;
    }

    if (search) {
        const regex = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [{ fullName: regex }, { email: regex }, { username: regex }, { phone: regex }];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
    const skip = (pageNum - 1) * limitNum;

    const [partners, total] = await Promise.all([
        Account.find(filter).select(partnerListSelect).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        Account.countDocuments(filter)
    ]);

    const partnerIds = partners.map((p) => p._id);
    const infos = await PartnerInformation.find({ accountId: { $in: partnerIds } })
        .select('accountId operatorName operatorPhone isVerified ratingAvg totalReviews')
        .lean();
    const infoMap = new Map(infos.map((info) => [info.accountId.toString(), info]));

    const data = partners.map((partner) => ({
        ...partner,
        partnerInformation: infoMap.get(partner._id.toString()) || null
    }));

    return {
        partners: data,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1
        }
    };
};

// ============================
// VIEW PARTNER DETAIL
// ============================

const getPartnerDetail = async (partnerId) => {
    const partner = await Account.findOne({ _id: partnerId, role: PARTNER, deletedAt: null })
        .select(partnerDetailSelect)
        .lean();

    if (!partner) {
        throw new AppError('Partner not found', 404);
    }

    const [partnerInformation, subscription, banHistory] = await Promise.all([
        PartnerInformation.findOne({ accountId: partnerId }).lean(),
        PartnerSubscription.findOne({ partnerId }).populate('planId', 'planName code price durationDays').lean(),
        BanHistory.find({ accountId: partnerId }).sort({ createdAt: -1 }).limit(5).lean()
    ]);

    return {
        partner,
        partnerInformation: partnerInformation || null,
        subscription: subscription || null,
        banHistory
    };
};

// ============================
// ENABLE / DISABLE PARTNER ACCOUNT
// ============================

const updatePartnerStatus = async (partnerId, { status, reason, type, expiredAt }, adminId) => {
    const partner = await Account.findOne({ _id: partnerId, role: PARTNER, deletedAt: null });

    if (!partner) {
        throw new AppError('Partner not found', 404);
    }

    if (partner.status === status) {
        throw new AppError(`Partner account is already ${status}`, 409);
    }

    const wasPendingApproval = partner.status === 'PENDING_APPROVAL';

    if (status === 'BANNED') {
        partner.banCounts += 1;

        await BanHistory.create({
            accountId: partner._id,
            bannedBy: adminId,
            banCounts: partner.banCounts,
            type: type || 'PERMANENT',
            reason: reason || '',
            expiredAt: expiredAt || null,
            status: 'ACTIVE'
        });
    } else {
        await BanHistory.updateMany(
            { accountId: partner._id, status: 'ACTIVE' },
            { status: 'REVOKED', unbannedAt: new Date() }
        );
    }

    partner.status = status;
    await partner.save();

    if (status === 'ACTIVE') {
        const partnerInfo = await PartnerInformation.findOneAndUpdate(
            { accountId: partner._id },
            { isVerified: true, verifiedAt: new Date() },
            { new: true }
        );

        if (wasPendingApproval && partnerInfo) {
            const partnerLoginUrl = process.env.PARTNER_DASHBOARD_LOGIN_URL || 'http://localhost:5173/login';
            emailService.sendPartnerWelcomeEmail(partner.email, partnerInfo.operatorName, partnerLoginUrl)
                .then(() => console.log(`[Admin Approval] Welcome email sent successfully to ${partner.email}`))
                .catch((err) => console.error(`[Admin Approval] Error sending welcome email:`, err));
        }
    }

    return {
        _id: partner._id,
        status: partner.status,
        banCounts: partner.banCounts
    };
};

// ============================
// DELETE PARTNER
// ============================

const deletePartner = async (partnerId) => {
    const partner = await Account.findOne({ _id: partnerId, role: PARTNER, deletedAt: null });

    if (!partner) {
        throw new AppError('Partner not found', 404);
    }

    partner.status = 'DELETED';
    partner.deletedAt = new Date();
    await partner.save();

    return { message: 'Partner deleted successfully' };
};

const _formatPartnerProfile = (profile) => ({
    _id: profile._id,
    accountId: profile.accountId._id,
    operatorName: profile.operatorName,
    operatorPhone: profile.operatorPhone,
    description: profile.description,
    amenities: profile.amenities,
    policies: profile.policies,
    profilePicture: profile.profilePicture,
    coverImage: profile.coverImage,
    bankName: profile.bankName,
    bankAccountName: profile.bankAccountName,
    bankNumber: profile.bankNumber,
    bankBranch: profile.bankBranch,
    sepayVa: profile.sepayVa,
    businessLicense: profile.businessLicense,
    taxCode: profile.taxCode,
    isVerified: profile.isVerified,
    verifiedAt: profile.verifiedAt,
    ratingAvg: profile.ratingAvg,
    totalReviews: profile.totalReviews,
    accountInfo: {
        fullName: profile.accountId?.fullName,
        email: profile.accountId?.email,
        phone: profile.accountId?.phone,
        profilePicture: profile.accountId?.profilePicture,
        isEmailVerified: profile.accountId?.isEmailVerified,
        isPhoneVerified: profile.accountId?.isPhoneVerified,
        status: profile.accountId?.status
    },
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
});

const _parseArrayField = (value, fieldName) => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value !== 'string') {
        throw new AppError(`${fieldName} must be an array`, 400);
    }
    const trimmedValue = value.trim();
    if (!trimmedValue) return [];
    try {
        const parsed = JSON.parse(trimmedValue);
        if (!Array.isArray(parsed)) throw new Error();
        return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
        return trimmedValue.split(',').map((item) => item.trim()).filter(Boolean);
    }
};

const _parseObjectField = (value, fieldName) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') {
        throw new AppError(`${fieldName} must be an object`, 400);
    }
    const trimmedValue = value.trim();
    if (!trimmedValue) return {};
    try {
        const parsed = JSON.parse(trimmedValue);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        return parsed;
    } catch {
        throw new AppError(`${fieldName} must be a valid JSON object`, 400);
    }
};

const getPartnerProfileByAccountId = async (accountId) => {
    const profile = await PartnerInformation.findOne({ accountId })
        .populate({
            path: 'accountId',
            select: 'fullName email phone profilePicture status isEmailVerified isPhoneVerified'
        })
        .exec();

    if (!profile) {
        throw new AppError('Partner profile not found', 404);
    }

    return _formatPartnerProfile(profile);
};

const updatePartnerProfileByAccountId = async (accountId, data, files = {}) => {
    if (!accountId) {
        throw new AppError('Account id is required', 400);
    }

    const account = await Account.findOne({ _id: accountId, role: PARTNER, deletedAt: null });

    if (!account) {
        throw new AppError('Partner account not found', 404);
    }

    const profile = await PartnerInformation.findOne({ accountId });

    if (!profile) {
        throw new AppError('Partner profile not found', 404);
    }

    const hasProfilePicture = Boolean(files.profilePicture?.[0]);
    const hasCoverImage = Boolean(files.coverImage?.[0]);
    const updatableFields = [
        'fullName',
        'phone',
        'gender',
        'dob',
        'operatorName',
        'operatorPhone',
        'description',
        'amenities',
        'policies',
        'bankName',
        'bankAccountName',
        'bankNumber',
        'bankBranch',
        'taxCode'
    ];
    const hasBodyUpdates = updatableFields.some((field) => data[field] !== undefined);

    if (!hasBodyUpdates && !hasProfilePicture && !hasCoverImage) {
        throw new AppError('No profile data provided for update', 400);
    }

    if (data.phone !== undefined && data.phone !== account.phone) {
        const existingPhone = await Account.findOne({
            _id: { $ne: account._id },
            phone: data.phone,
            deletedAt: null
        });

        if (existingPhone) {
            throw new AppError('This phone number is already registered', 409);
        }

        account.phone = data.phone;
    }

    if (data.fullName !== undefined) {
        account.fullName = data.fullName.trim();
    }

    if (data.gender !== undefined) {
        account.gender = data.gender;
    }

    if (data.dob !== undefined) {
        account.dob = data.dob ? new Date(data.dob) : null;
    }

    if (data.operatorName !== undefined) {
        profile.operatorName = data.operatorName.trim();
    }

    if (data.operatorPhone !== undefined) {
        profile.operatorPhone = data.operatorPhone;
    }

    if (data.description !== undefined) {
        profile.description = data.description;
    }

    if (data.amenities !== undefined) {
        profile.amenities = _parseArrayField(data.amenities, 'amenities');
    }

    if (data.policies !== undefined) {
        profile.policies = _parseObjectField(data.policies, 'policies');
    }

    ['bankName', 'bankAccountName', 'bankNumber', 'bankBranch', 'taxCode'].forEach((field) => {
        if (data[field] !== undefined) {
            profile[field] = data[field] || null;
        }
    });

    if (hasProfilePicture) {
        const uploaded = await uploadToCloudinary(files.profilePicture[0].buffer, PARTNER_PROFILE_FOLDER);
        profile.profilePicture = uploaded.url;
        account.profilePicture = uploaded.url;
    }

    if (hasCoverImage) {
        const uploaded = await uploadToCloudinary(files.coverImage[0].buffer, PARTNER_COVER_FOLDER);
        profile.coverImage = uploaded.url;
    }

    await Promise.all([account.save(), profile.save()]);

    return getPartnerProfileByAccountId(accountId);
};

// ============================
// PENDING REGISTRATION MANAGEMENT (Admin)
// ============================

const getPendingRegistrations = async ({ status, search, page = 1, limit = 10 }) => {
    const filter = { };

    if (status) {
        filter.licenseStatus = status;
    } else {
        filter.licenseStatus = { $in: ['PENDING', 'REJECTED'] };
    }

    // Find PartnerInformation records that belong to PENDING_APPROVAL accounts
    const pendingAccounts = await Account.find({
        role: PARTNER,
        status: 'PENDING_APPROVAL',
        deletedAt: null
    }).select('_id');

    const pendingAccountIds = pendingAccounts.map(a => a._id);
    filter.accountId = { $in: pendingAccountIds };

    if (search) {
        const regex = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [{ operatorName: regex }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await PartnerInformation.countDocuments(filter);

    const registrations = await PartnerInformation.find(filter)
        .populate('accountId', 'email fullName phone status createdAt')
        .populate('selectedPlanId', 'planName price discount durationDays')
        .populate('reviewedBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

    return {
        registrations,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit))
        }
    };
};

const reviewPendingRegistration = async (partnerInfoId, { status, rejectionReason }, adminId) => {
    const partnerInfo = await PartnerInformation.findById(partnerInfoId)
        .populate('accountId', 'email fullName status');

    if (!partnerInfo) {
        throw new AppError('Pending registration not found', 404);
    }

    if (!partnerInfo.accountId || partnerInfo.accountId.status !== 'PENDING_APPROVAL') {
        throw new AppError('This registration is not in pending approval state', 400);
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
        throw new AppError('Status must be APPROVED or REJECTED', 400);
    }

    if (status === 'REJECTED' && !rejectionReason) {
        throw new AppError('Rejection reason is required when rejecting', 400);
    }

    // Update license review status
    partnerInfo.licenseStatus = status;
    partnerInfo.reviewedBy = adminId;
    partnerInfo.reviewedAt = new Date();

    if (status === 'REJECTED') {
        partnerInfo.rejectionReason = rejectionReason;
    } else {
        partnerInfo.rejectionReason = null;
    }

    await partnerInfo.save();

    // Send email notification
    const partnerEmail = partnerInfo.accountId.email;
    const operatorName = partnerInfo.operatorName;

    if (status === 'APPROVED') {
        emailService.sendLicenseApprovedEmail(partnerEmail, operatorName)
            .then(() => console.log(`[Admin Review] License approved email sent to ${partnerEmail}`))
            .catch((err) => console.error(`[Admin Review] Error sending approval email:`, err));
    } else {
        emailService.sendLicenseRejectedEmail(partnerEmail, operatorName, rejectionReason)
            .then(() => console.log(`[Admin Review] License rejected email sent to ${partnerEmail}`))
            .catch((err) => console.error(`[Admin Review] Error sending rejection email:`, err));
    }

    return {
        _id: partnerInfo._id,
        operatorName: partnerInfo.operatorName,
        licenseStatus: partnerInfo.licenseStatus,
        rejectionReason: partnerInfo.rejectionReason,
        reviewedAt: partnerInfo.reviewedAt
    };
};

module.exports = {
    getPartners,
    getPartnerDetail,
    updatePartnerStatus,
    deletePartner,
    getPartnerProfileByAccountId,
    updatePartnerProfileByAccountId,
    getPendingRegistrations,
    reviewPendingRegistration
};
