const Account = require('../models/Account');
const PartnerInformation = require('../models/PartnerInformation');
const PartnerSubscription = require('../models/PartnerSubscription');
const BanHistory = require('../models/BanHistory');
const AppError = require('../utils/AppError');
const { PARTNER } = require('../constants/roles');

const partnerListSelect = '_id username email phone fullName status profilePicture isEmailVerified isPhoneVerified banCounts createdAt updatedAt';
const partnerDetailSelect = `${partnerListSelect} gender dob isAutoPublishBlog`;

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

module.exports = {
    getPartners,
    getPartnerDetail,
    updatePartnerStatus,
    deletePartner
};
