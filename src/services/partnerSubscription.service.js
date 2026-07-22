const mongoose = require('mongoose');
const PartnerSubscription = require('../models/PartnerSubscription');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const Transaction = require('../models/Transaction');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const AppError = require('../utils/AppError');

const getMySubscriptions = async (partnerId, query) => {
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
            match.subscriptionDate.$lte = end;
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

const PAYMENT_WINDOW_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const getDiscountedPrice = (plan) => Math.max(
    0,
    Math.round(Number(plan.price) * (1 - Number(plan.discount || 0) / 100))
);

const getPaymentDetails = (transaction) => {
    const adminVa = process.env.ADMIN_SEPAY_VA || '7411208853';
    const adminBank = process.env.ADMIN_SEPAY_BANK || 'BIDV';
    const qrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(adminVa)}&bank=${encodeURIComponent(adminBank)}&amount=${transaction.amount}&des=${encodeURIComponent(transaction.content)}`;

    return {
        transactionId: transaction._id,
        amount: transaction.amount,
        currency: transaction.currency,
        content: transaction.content,
        status: transaction.status,
        expiresAt: transaction.expiresAt,
        qrUrl,
        bank: adminBank,
        accountNumber: adminVa,
        operation: transaction.metadata?.operation || null,
        planId: transaction.metadata?.planId || null,
        planName: transaction.metadata?.planName || null
    };
};

const expireStaleRenewals = async (partnerId) => {
    await Transaction.updateMany(
        {
            partnerId,
            transactionType: 'SUBSCRIPTION_PAYMENT',
            status: 'PENDING',
            'metadata.operation': { $in: ['EXTEND', 'RENEW'] },
            expiresAt: { $lte: new Date() }
        },
        {
            $set: { status: 'EXPIRED' },
            $unset: { 'metadata.renewalLock': '' }
        }
    );
};

const normalizeSubscriptionStatus = async (subscription) => {
    if (
        subscription
        && subscription.subscriptionStatus === 'ACTIVE'
        && new Date(subscription.expirationDate) <= new Date()
    ) {
        subscription.subscriptionStatus = 'EXPIRED';
        await subscription.save();
    }
    return subscription;
};

const getRemainingTime = (expirationDate) => {
    const milliseconds = Math.max(new Date(expirationDate).getTime() - Date.now(), 0);
    return {
        milliseconds,
        days: Math.floor(milliseconds / DAY_MS),
        hours: Math.floor((milliseconds % DAY_MS) / (60 * 60 * 1000)),
        minutes: Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000)),
        expired: milliseconds === 0
    };
};

const calculateQueuedPeriod = ({ now, currentExpiration, lastQueuedExpiration, durationDays }) => {
    const candidates = [new Date(now).getTime()];
    if (currentExpiration) candidates.push(new Date(currentExpiration).getTime());
    if (lastQueuedExpiration) candidates.push(new Date(lastQueuedExpiration).getTime());
    const scheduledStartDate = new Date(Math.max(...candidates));
    return {
        scheduledStartDate,
        scheduledExpirationDate: new Date(scheduledStartDate.getTime() + Number(durationDays) * DAY_MS)
    };
};

const getOverview = async (partnerId) => {
    await expireStaleRenewals(partnerId);
    await activateDueSubscriptions(partnerId);

    let subscription = await PartnerSubscription.findOne({ partnerId }).populate('planId').exec();
    subscription = await normalizeSubscriptionStatus(subscription);

    const [pendingTransaction, queuedSubscriptions, history] = await Promise.all([
        Transaction.findOne({
            partnerId,
            subscriptionId: subscription?._id || null,
            transactionType: 'SUBSCRIPTION_PAYMENT',
            status: { $in: ['PENDING', 'PROCESSING'] },
            'metadata.operation': { $in: ['EXTEND', 'RENEW'] }
        }).sort({ createdAt: -1 }).lean(),
        SubscriptionHistory.find({ partnerId, subscriptionStatus: 'PENDING' })
            .populate('planId', 'planName code price discount durationDays planFeatures maxBuses maxRoutes')
            .sort({ subscriptionDate: 1 })
            .lean(),
        SubscriptionHistory.find({ partnerId })
            .populate('planId', 'planName code price discount durationDays')
            .sort({ createdAt: -1 })
            .limit(20)
            .lean()
    ]);

    const plan = subscription?.planId || null;
    const remainingTime = subscription ? getRemainingTime(subscription.expirationDate) : null;
    return {
        subscription: subscription ? {
            _id: subscription._id,
            status: subscription.subscriptionStatus,
            subscriptionDate: subscription.subscriptionDate,
            expirationDate: subscription.expirationDate,
            daysRemaining: Math.ceil(remainingTime.milliseconds / DAY_MS),
            remainingTime,
            autoRenew: subscription.autoRenew,
            canExtend: ['ACTIVE', 'EXPIRED', 'CANCELLED'].includes(subscription.subscriptionStatus)
                && plan?.status === 'ACTIVE',
            canRenew: ['ACTIVE', 'EXPIRED', 'CANCELLED'].includes(subscription.subscriptionStatus),
            plan: plan ? {
                _id: plan._id,
                planName: plan.planName,
                code: plan.code,
                description: plan.description,
                price: plan.price,
                discount: plan.discount,
                renewalPrice: getDiscountedPrice(plan),
                durationDays: plan.durationDays,
                planFeatures: plan.planFeatures,
                maxBuses: plan.maxBuses,
                maxRoutes: plan.maxRoutes,
                status: plan.status
            } : null
        } : null,
        pendingPayment: pendingTransaction ? getPaymentDetails(pendingTransaction) : null,
        queue: queuedSubscriptions.map((item, index) => ({
            position: index + 1,
            _id: item._id,
            operation: item.operation,
            scheduledStartDate: item.subscriptionDate,
            scheduledExpirationDate: item.expirationDate,
            status: item.subscriptionStatus,
            plan: item.planId
        })),
        history: history.map((item) => ({
            _id: item._id,
            transactionId: item.transactionId,
            operation: item.operation,
            subscriptionDate: item.subscriptionDate,
            expirationDate: item.expirationDate,
            status: item.subscriptionStatus,
            plan: item.planId
        }))
    };
};

const createSubscriptionPayment = async (partnerId, operation, requestedPlanId = null) => {
    await expireStaleRenewals(partnerId);

    let subscription = await PartnerSubscription.findOne({ partnerId })
        .populate('planId')
        .exec();
    subscription = await normalizeSubscriptionStatus(subscription);

    if (!subscription) {
        throw new AppError('No subscription was found for this partner', 404);
    }
    if (!['ACTIVE', 'EXPIRED', 'CANCELLED'].includes(subscription.subscriptionStatus)) {
        throw new AppError('This subscription cannot be renewed in its current state', 409);
    }

    const plan = operation === 'EXTEND'
        ? subscription.planId
        : await SubscriptionPlan.findOne({ _id: requestedPlanId, status: 'ACTIVE' });
    if (!plan || plan.status !== 'ACTIVE') {
        throw new AppError('The selected subscription plan is not available', 409);
    }
    if (operation === 'RENEW' && String(plan._id) === String(subscription.planId._id)) {
        throw new AppError('Use Extend to continue with the current plan', 409);
    }

    const existing = await Transaction.findOne({
        partnerId,
        subscriptionId: subscription._id,
        transactionType: 'SUBSCRIPTION_PAYMENT',
        status: { $in: ['PENDING', 'PROCESSING'] },
        'metadata.operation': { $in: ['EXTEND', 'RENEW'] },
        expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (existing) {
        if (existing.metadata?.operation !== operation || String(existing.metadata?.planId) !== String(plan._id)) {
            throw new AppError('Complete or cancel the existing subscription payment first', 409);
        }
        return { payment: getPaymentDetails(existing), reused: true };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + PAYMENT_WINDOW_MS);

    const transaction = new Transaction({
        partnerId,
        subscriptionId: subscription._id,
        transactionType: 'SUBSCRIPTION_PAYMENT',
        amount: getDiscountedPrice(plan),
        currency: 'VND',
        status: 'PENDING',
        expiresAt,
        gateway: 'SEPAY',
        description: `${operation === 'EXTEND' ? 'Extend' : 'Renew with'} ${plan.planName} subscription`,
        metadata: {
            operation,
            planId: plan._id,
            planName: plan.planName,
            durationDays: plan.durationDays,
            renewalLock: String(partnerId)
        }
    });

    transaction.code = `BUSNET_SUB_${transaction._id}`;
    transaction.content = `BUSNET SUB ${transaction._id}`;
    try {
        await transaction.save();
    } catch (error) {
        if (error?.code !== 11000) throw error;

        await Transaction.deleteOne({ _id: transaction._id, status: 'PENDING' });
        const concurrentPayment = await Transaction.findOne({
            partnerId,
            transactionType: 'SUBSCRIPTION_PAYMENT',
            status: { $in: ['PENDING', 'PROCESSING'] },
            'metadata.operation': { $in: ['EXTEND', 'RENEW'] },
            expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 });
        if (!concurrentPayment) throw error;
        return { payment: getPaymentDetails(concurrentPayment), reused: true };
    }

    return { payment: getPaymentDetails(transaction), reused: false };
};

const createExtension = async (partnerId) => createSubscriptionPayment(partnerId, 'EXTEND');

const createRenewal = async (partnerId, planId) => {
    if (!mongoose.isValidObjectId(planId)) throw new AppError('Invalid plan ID', 400);
    return createSubscriptionPayment(partnerId, 'RENEW', planId);
};

const getRenewalOptions = async (partnerId) => {
    const subscription = await PartnerSubscription.findOne({ partnerId }).select('planId').lean();
    if (!subscription) throw new AppError('No subscription was found for this partner', 404);

    const plans = await SubscriptionPlan.find({
        status: 'ACTIVE',
        _id: { $ne: subscription.planId }
    }).sort({ price: 1 }).lean();
    return plans.map((plan) => ({
        ...plan,
        finalPrice: getDiscountedPrice(plan),
        isCurrentPlan: false
    }));
};

const getRenewalStatus = async (partnerId, transactionId) => {
    if (!mongoose.isValidObjectId(transactionId)) {
        throw new AppError('Invalid transaction ID', 400);
    }

    const transaction = await Transaction.findOne({
        _id: transactionId,
        partnerId,
        transactionType: 'SUBSCRIPTION_PAYMENT',
        'metadata.operation': { $in: ['EXTEND', 'RENEW'] }
    });

    if (!transaction) {
        throw new AppError('Renewal transaction not found', 404);
    }

    if (transaction.status === 'PENDING' && transaction.expiresAt <= new Date()) {
        transaction.status = 'EXPIRED';
        if (transaction.metadata?.renewalLock) {
            delete transaction.metadata.renewalLock;
            transaction.markModified('metadata');
        }
        await transaction.save();
    }

    const queuedSubscription = transaction.status === 'SUCCESS'
        ? await SubscriptionHistory.findOne({ transactionId: transaction._id })
            .populate('planId', 'planName code durationDays')
            .lean()
        : null;

    return {
        ...getPaymentDetails(transaction),
        operation: transaction.metadata?.operation,
        queuedSubscription: queuedSubscription ? {
            status: queuedSubscription.subscriptionStatus,
            scheduledStartDate: queuedSubscription.subscriptionDate,
            scheduledExpirationDate: queuedSubscription.expirationDate,
            plan: queuedSubscription.planId
        } : null
    };
};

const cancelRenewal = async (partnerId, transactionId) => {
    if (!mongoose.isValidObjectId(transactionId)) {
        throw new AppError('Invalid transaction ID', 400);
    }

    const transaction = await Transaction.findOneAndUpdate(
        {
            _id: transactionId,
            partnerId,
            transactionType: 'SUBSCRIPTION_PAYMENT',
            status: 'PENDING',
            'metadata.operation': { $in: ['EXTEND', 'RENEW'] }
        },
        {
            $set: { status: 'CANCELLED' },
            $unset: { 'metadata.renewalLock': '' }
        },
        { returnDocument: 'after' }
    );

    if (!transaction) {
        throw new AppError('Only a pending renewal payment can be cancelled', 409);
    }

    return { transactionId: transaction._id, status: transaction.status };
};

const activateDueSubscriptions = async (partnerId = null) => {
    const now = new Date();
    const filter = { subscriptionStatus: 'PENDING', subscriptionDate: { $lte: now } };
    if (partnerId) filter.partnerId = partnerId;

    const dueItems = await SubscriptionHistory.find(filter).sort({ subscriptionDate: 1, createdAt: 1 });
    let activated = 0;
    for (const queuedItem of dueItems) {
        const subscription = await PartnerSubscription.findOne({ partnerId: queuedItem.partnerId });
        if (!subscription) continue;

        if (
            subscription.subscriptionStatus === 'ACTIVE'
            && new Date(subscription.expirationDate) > now
        ) {
            continue;
        }

        await SubscriptionHistory.updateMany(
            {
                partnerId: queuedItem.partnerId,
                subscriptionStatus: 'ACTIVE',
                expirationDate: { $lte: now }
            },
            { $set: { subscriptionStatus: 'EXPIRED' } }
        );

        subscription.planId = queuedItem.planId;
        subscription.subscriptionDate = queuedItem.subscriptionDate;
        subscription.expirationDate = queuedItem.expirationDate;
        subscription.subscriptionStatus = 'ACTIVE';
        subscription.cancelledAt = null;
        await subscription.save();

        queuedItem.subscriptionStatus = 'ACTIVE';
        await queuedItem.save();
        activated += 1;
    }
    return { activated };
};

const fulfillSubscriptionPurchase = async (transaction) => {
    const existingHistory = await SubscriptionHistory.findOne({ transactionId: transaction._id });
    if (existingHistory) return existingHistory;

    const metadata = transaction.metadata || {};
    if (!['EXTEND', 'RENEW'].includes(metadata.operation) || !mongoose.isValidObjectId(metadata.planId)) {
        throw new AppError('Subscription payment metadata is incomplete', 409);
    }

    const [subscription, plan, lastQueuedItem] = await Promise.all([
        PartnerSubscription.findOne({ _id: transaction.subscriptionId, partnerId: transaction.partnerId }),
        SubscriptionPlan.findById(metadata.planId),
        SubscriptionHistory.findOne({
            partnerId: transaction.partnerId,
            subscriptionStatus: 'PENDING'
        }).sort({ expirationDate: -1 })
    ]);
    if (!subscription) throw new AppError('The linked subscription no longer exists', 409);
    if (!plan) throw new AppError('The purchased subscription plan no longer exists', 409);

    const { scheduledStartDate, scheduledExpirationDate } = calculateQueuedPeriod({
        now: new Date(),
        currentExpiration: subscription.subscriptionStatus === 'ACTIVE'
            ? subscription.expirationDate
            : null,
        lastQueuedExpiration: lastQueuedItem?.expirationDate || null,
        durationDays: plan.durationDays
    });

    const queuedItem = await SubscriptionHistory.create({
        partnerId: transaction.partnerId,
        planId: plan._id,
        transactionId: transaction._id,
        operation: metadata.operation,
        subscriptionDate: scheduledStartDate,
        expirationDate: scheduledExpirationDate,
        subscriptionStatus: 'PENDING'
    });

    await activateDueSubscriptions(transaction.partnerId);
    return SubscriptionHistory.findById(queuedItem._id);
};

const getMySubscriptions = async (partnerId, query = {}) => {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 5, 1), 100);
    if (!mongoose.isValidObjectId(partnerId)) throw new AppError('Invalid partner ID', 400);

    const match = { partnerId: new mongoose.Types.ObjectId(partnerId) };
    if (query.subscriptionStatus) match.subscriptionStatus = query.subscriptionStatus;
    if (query.planId) {
        if (!mongoose.isValidObjectId(query.planId)) throw new AppError('Invalid plan ID', 400);
        match.planId = new mongoose.Types.ObjectId(query.planId);
    }

    const addDateRange = (field, from, to) => {
        if (!from && !to) return;
        match[field] = {};
        if (from) match[field].$gte = new Date(from);
        if (to) {
            const end = new Date(to);
            end.setHours(23, 59, 59, 999);
            match[field].$lte = end;
        }
    };
    addDateRange('subscriptionDate', query.subscriptionDateFrom, query.subscriptionDateTo);
    addDateRange('expirationDate', query.expirationDateFrom, query.expirationDateTo);

    const sortOptions = {
        subscriptionDate_asc: { subscriptionDate: 1 },
        subscriptionDate_desc: { subscriptionDate: -1 },
        expirationDate_asc: { expirationDate: 1 },
        expirationDate_desc: { expirationDate: -1 },
        price_asc: { 'plan.price': 1 },
        price_desc: { 'plan.price': -1 }
    };
    const pipeline = [
        { $match: match },
        {
            $lookup: {
                from: 'subscription_plans',
                localField: 'planId',
                foreignField: '_id',
                as: 'plan'
            }
        },
        { $unwind: '$plan' }
    ];
    if (query.keyword) {
        pipeline.push({
            $match: {
                $or: [
                    { 'plan.planName': { $regex: query.keyword, $options: 'i' } },
                    { 'plan.code': { $regex: query.keyword, $options: 'i' } }
                ]
            }
        });
    }
    pipeline.push({ $sort: sortOptions[query.sortBy] || sortOptions.subscriptionDate_desc });

    const countResult = await SubscriptionHistory.aggregate([...pipeline, { $count: 'total' }]);
    const total = countResult[0]?.total || 0;
    pipeline.push(
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
            $project: {
                subscriptionDate: 1,
                expirationDate: 1,
                subscriptionStatus: 1,
                operation: 1,
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

    return {
        data: await SubscriptionHistory.aggregate(pipeline),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
};

module.exports = {
    getMySubscriptions,
    getOverview,
    getRenewalOptions,
    createExtension,
    createRenewal,
    getRenewalStatus,
    cancelRenewal,
    fulfillSubscriptionPurchase,
    fulfillRenewal: fulfillSubscriptionPurchase,
    activateDueSubscriptions,
    calculateQueuedPeriod
};
