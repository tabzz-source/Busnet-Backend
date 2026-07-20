const mongoose = require('mongoose');
const SubscriptionHistory = require('../models/SubscriptionHistory');

exports.getMySubscriptions = async (partnerId, query) => {
    const {
        page = 1,
        limit = 5,
        keyword,
        subscriptionStatus,
        planId,
        subscriptionDateFrom,
        subscriptionDateTo,
        expirationDateFrom,
        expirationDateTo,
        sortBy = 'subscriptionDate_desc'
    } = query;

    const match = {
        partnerId: new mongoose.Types.ObjectId(partnerId)
    };

    if (subscriptionStatus) {
        match.subscriptionStatus = subscriptionStatus;
    }

    if (planId && mongoose.Types.ObjectId.isValid(planId)) {
        match.planId = new mongoose.Types.ObjectId(planId);
    }

    if (subscriptionDateFrom || subscriptionDateTo) {
        match.subscriptionDate = {};

        if (subscriptionDateFrom) {
            match.subscriptionDate.$gte = new Date(subscriptionDateFrom);
        }

        if (subscriptionDateTo) {
            const end = new Date(subscriptionDateTo);
            end.setHours(23, 59, 59, 999);
            match.subscriptionDateTo.$lte = end;
        }
    }

    if (expirationDateFrom || expirationDateTo) {
        match.expirationDate = {};

        if (expirationDateFrom) {
            match.expirationDate.$gte = new Date(expirationDateFrom);
        }

        if (expirationDateTo) {
            const end = new Date(expirationDateTo);
            end.setHours(23, 59, 59, 999);
            match.expirationDate.$lte = end;
        }
    }

    let sort = {
        subscriptionDate: -1
    };

    switch (sortBy) {
        case 'subscriptionDate_asc':
            sort = { subscriptionDate: 1 };
            break;

        case 'subscriptionDate_desc':
            sort = { subscriptionDate: -1 };
            break;

        case 'expirationDate_asc':
            sort = { expirationDate: 1 };
            break;

        case 'expirationDate_desc':
            sort = { expirationDate: -1 };
            break;

        case 'price_asc':
            sort = { 'plan.price': 1 };
            break;

        case 'price_desc':
            sort = { 'plan.price': -1 };
            break;
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

    pipeline.push({
        $sort: sort
    });

    // Count total records
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await SubscriptionHistory.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Pagination
    pipeline.push(
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