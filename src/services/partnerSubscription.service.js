const mongoose = require('mongoose');
const SubscriptionHistory = require('../models/SubscriptionHistory');

exports.getMySubscriptions = async (partnerId, query) => {
    const {
        page = 1,
        limit = 5,
        keyword,
        subscriptionStatus
    } = query;

    const match = {
        partnerId: new mongoose.Types.ObjectId(partnerId)
    };

    if (subscriptionStatus) {
        match.subscriptionStatus = subscriptionStatus;
    }

    const pipeline = [
        {
            $match: match
        },
        {
            $lookup: {
                from: 'subscription_plans',
                localField: 'planId',
                foreignField: '_id',
                as: 'plan'
            }
        },
        {
            $unwind: '$plan'
        }
    ];

    if (keyword) {
        pipeline.push({
            $match: {
                $or: [
                    {
                        'plan.planName': {
                            $regex: keyword,
                            $options: 'i'
                        }
                    },
                    {
                        'plan.code': {
                            $regex: keyword,
                            $options: 'i'
                        }
                    }
                ]
            }
        });
    }

    // Count total records
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await SubscriptionHistory.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Pagination
    pipeline.push(
        {
            $sort: {
                subscriptionDate: -1
            }
        },
        {
            $skip: (Number(page) - 1) * Number(limit)
        },
        {
            $limit: Number(limit)
        },
        {
            $project: {
                subscriptionDate: 1,
                expirationDate: 1,
                subscriptionStatus: 1,
                transactionId: 1,
                plan: {
                    _id: '$plan._id',
                    planName: '$plan.planName',
                    code: '$plan.code',
                    price: '$plan.price',
                    durationDays: '$plan.durationDays',
                    discount: '$plan.discount'
                }
            }
        }
    );

    const subscriptions = await SubscriptionHistory.aggregate(pipeline);

    return {
        data: subscriptions,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
        }
    };
};