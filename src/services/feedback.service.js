const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const Booking = require('../models/Booking');
const PartnerInformation = require('../models/PartnerInformation');
const AppError = require('../utils/AppError');

const recalculatePartnerRating = async (partnerId) => {
    const result = await Feedback.aggregate([
        {
            $match: {
                partnerId: new mongoose.Types.ObjectId(partnerId),
                status: 'VISIBLE'
            }
        },
        {
            $group: {
                _id: '$partnerId',
                ratingAvg: { $avg: '$rating' },
                totalReviews: { $sum: 1 }
            }
        }
    ]);

    const ratingStats = result[0];

    await PartnerInformation.findOneAndUpdate(
        { accountId: partnerId },
        {
            ratingAvg: ratingStats ? Number(ratingStats.ratingAvg.toFixed(1)) : 0,
            totalReviews: ratingStats ? ratingStats.totalReviews : 0
        },
        { new: true }
    );
};

const createFeedback = async (customerId, payload) => {
    const {
        bookingId,
        rating,
        review = '',
        reviewImages = [],
        type = 'TRIP'
    } = payload;

    if (type !== 'TRIP') {
        throw new AppError('Use operator feedback endpoint to review an operator', 400);
    }

    const booking = await Booking.findById(bookingId).lean();

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    if (String(booking.customerId) !== String(customerId)) {
        throw new AppError('You are not allowed to review this booking', 403);
    }

    if (booking.status !== 'COMPLETED') {
        throw new AppError(
            'You can only rate a completed trip',
            400
        );
    }

    const existedFeedback = await Feedback.findOne({
        bookingId,
        customerId
    }).lean();

    if (existedFeedback) {
        throw new AppError('You have already reviewed this booking', 409);
    }

    const feedback = await Feedback.create({
        bookingId,
        customerId,
        partnerId: booking.partnerId,
        rating,
        review,
        reviewImages,
        type: 'TRIP',
        status: 'VISIBLE'
    });

    await recalculatePartnerRating(booking.partnerId);

    return feedback;
};

const createOperatorFeedback = async (customerId, partnerId, payload) => {
    const {
        rating,
        review = '',
        reviewImages = []
    } = payload;

    const partnerInfo = await PartnerInformation.findOne({
        accountId: partnerId,
        isVerified: true
    }).lean();

    if (!partnerInfo) {
        throw new AppError('Operator not found', 404);
    }

    if (String(customerId) === String(partnerId)) {
        throw new AppError('You cannot review your own operator profile', 400);
    }

    const existedFeedback = await Feedback.findOne({
        partnerId,
        customerId,
        type: 'OPERATOR'
    }).lean();

    if (existedFeedback) {
        throw new AppError('You have already written feedback for this operator', 409);
    }

    const feedback = await Feedback.create({
        bookingId: null,
        customerId,
        partnerId,
        rating,
        review,
        reviewImages,
        type: 'OPERATOR',
        status: 'VISIBLE'
    });

    await recalculatePartnerRating(partnerId);

    return feedback;
};

const getMyFeedbacks = async (customerId, query = {}) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const filter = {
        customerId,
        status: { $ne: 'DELETED' }
    };

    if (query.type) {
        filter.type = query.type;
    }

    const [feedbacks, total] = await Promise.all([
        Feedback.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'bookingId',
                select: 'bookingCode status total passengerName passengerPhone createdAt'
            })
            .populate({
                path: 'partnerId',
                select: '_id fullName email phone role status'
            })
            .lean(),
        Feedback.countDocuments(filter)
    ]);

    return {
        feedbacks,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

const getFeedbacksByTrip = async (tripId, query = {}) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const bookingFilter = {
        tripId
    };

    const bookings = await Booking.find(bookingFilter)
        .select('_id')
        .lean();

    const bookingIds = bookings.map((booking) => booking._id);

    const filter = {
        bookingId: { $in: bookingIds },
        status: 'VISIBLE'
    };

    const [feedbacks, total] = await Promise.all([
        Feedback.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'customerId',
                select: '_id fullName profilePicture'
            })
            .lean(),
        Feedback.countDocuments(filter)
    ]);

    return {
        feedbacks,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

const getFeedbacksByPartner = async (partnerId, query = {}) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const filter = {
        partnerId,
        status: 'VISIBLE'
    };

    const [feedbacks, total] = await Promise.all([
        Feedback.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'customerId',
                select: '_id fullName profilePicture'
            })
            .lean(),
        Feedback.countDocuments(filter)
    ]);

    return {
        feedbacks,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

module.exports = {
    createFeedback,
    createOperatorFeedback,
    getMyFeedbacks,
    getFeedbacksByTrip,
    getFeedbacksByPartner
};
