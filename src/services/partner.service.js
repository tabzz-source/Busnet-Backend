const Account = require('../models/Account');
const PartnerInformation = require('../models/PartnerInformation');

class PartnerService {
    /**
     * Get partner profile by accountId (for authenticated partners)
     * Returns full profile with all partner information
     */
    async getPartnerProfileByAccountId(accountId) {
        try {
            const profile = await PartnerInformation.findOne({ accountId })
                .populate({
                    path: 'accountId',
                    select: 'fullName email phone profilePicture status isEmailVerified isPhoneVerified'
                })
                .exec();

            if (!profile) {
                const error = new Error('Partner profile not found');
                error.statusCode = 404;
                throw error;
            }

            // Return complete profile for authenticated partner
            return this._formatProfile(profile);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Format profile data for partner view
     */
    _formatProfile(profile) {
        return {
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
        };
    }
}

module.exports = new PartnerService();
