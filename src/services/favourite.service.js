const Account = require('../models/Account');
const PartnerInformation = require('../models/PartnerInformation');
const FavouriteOperator = require('../models/FavouriteOperator');
const AppError = require('../utils/AppError');

const checkPartnerExists = async (partnerId) => {
    const partner = await Account.findOne({
        _id: partnerId,
        role: 'PARTNER',
        status: { $ne: 'DELETED' }
    }).select('_id role status');

    if (!partner) {
        throw new AppError('Partner not found', 404);
    }

    return partner;
};

const getFavouriteOperators = async (customerId) => {
    const favourites = await FavouriteOperator.find({ customerId })
        .sort({ createdAt: -1 })
        .populate({
            path: 'partnerId',
            select: '_id fullName email phone role status profilePicture'
        })
        .lean();

    const partnerIds = favourites
        .map((item) => item.partnerId?._id)
        .filter(Boolean);

    const partnerInfos = await PartnerInformation.find({
        accountId: { $in: partnerIds }
    })
        .select(
            'accountId operatorName operatorPhone description amenities profilePicture coverImage ratingAvg totalReviews isVerified'
        )
        .lean();

    const partnerInfoMap = new Map(
        partnerInfos.map((info) => [String(info.accountId), info])
    );

    return favourites.map((item) => {
        const partnerAccount = item.partnerId;
        const partnerInfo = partnerAccount
            ? partnerInfoMap.get(String(partnerAccount._id))
            : null;

        return {
            _id: item._id,
            customerId: item.customerId,
            partnerId: partnerAccount?._id || null,
            partner: {
                account: partnerAccount,
                information: partnerInfo
            },
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        };
    });
};

const addFavouriteOperator = async (customerId, partnerId) => {
    await checkPartnerExists(partnerId);

    const favourite = await FavouriteOperator.findOneAndUpdate(
        {
            customerId,
            partnerId
        },
        {
            $setOnInsert: {
                customerId,
                partnerId
            }
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    return favourite;
};

const removeFavouriteOperator = async (customerId, partnerId) => {
    await checkPartnerExists(partnerId);

    const favourite = await FavouriteOperator.findOneAndDelete({
        customerId,
        partnerId
    });

    if (!favourite) {
        throw new AppError('Favourite operator not found', 404);
    }

    return favourite;
};

const getFavouriteOperatorStatus = async (customerId, partnerId) => {
    await checkPartnerExists(partnerId);

    const favourite = await FavouriteOperator.findOne({
        customerId,
        partnerId
    }).select('_id createdAt');

    return {
        isFavourite: !!favourite,
        favouriteId: favourite?._id || null,
        createdAt: favourite?.createdAt || null
    };
};

module.exports = {
    getFavouriteOperators,
    addFavouriteOperator,
    removeFavouriteOperator,
    getFavouriteOperatorStatus
};