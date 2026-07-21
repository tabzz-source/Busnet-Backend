const mongoose = require('mongoose');
const PartnerSubscription = require('../models/PartnerSubscription');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const Transaction = require('../models/Transaction');
const AppError = require('../utils/AppError');

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
        accountNumber: adminVa
    };
};

const expireStaleRenewals = async (partnerId) => {
    await Transaction.updateMany(
        {
            partnerId,
            transactionType: 'SUBSCRIPTION_PAYMENT',
            status: 'PENDING',
            'metadata.operation': 'RENEW',
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

const getOverview = async (partnerId) => {
    await expireStaleRenewals(partnerId);

    let subscription = await PartnerSubscription.findOne({ partnerId })
        .populate('planId')
        .exec();

    subscription = await normalizeSubscriptionStatus(subscription);

    const [pendingTransaction, history] = await Promise.all([
        Transaction.findOne({
            partnerId,
            subscriptionId: subscription?._id || null,
            transactionType: 'SUBSCRIPTION_PAYMENT',
            status: { $in: ['PENDING', 'PROCESSING'] },
            'metadata.operation': 'RENEW'
        }).sort({ createdAt: -1 }).lean(),
        SubscriptionHistory.find({ partnerId })
            .populate('planId', 'planName code price discount durationDays')
            .sort({ createdAt: -1 })
            .limit(20)
            .lean()
    ]);

    const plan = subscription?.planId || null;
    const now = Date.now();
    const expirationTime = subscription ? new Date(subscription.expirationDate).getTime() : null;
    const daysRemaining = expirationTime === null
        ? null
        : Math.max(0, Math.ceil((expirationTime - now) / DAY_MS));

    return {
        subscription: subscription ? {
            _id: subscription._id,
            status: subscription.subscriptionStatus,
            subscriptionDate: subscription.subscriptionDate,
            expirationDate: subscription.expirationDate,
            daysRemaining,
            autoRenew: subscription.autoRenew,
            canRenew: ['ACTIVE', 'EXPIRED', 'CANCELLED'].includes(subscription.subscriptionStatus)
                && plan?.status === 'ACTIVE',
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
        history: history.map((item) => ({
            _id: item._id,
            transactionId: item.transactionId,
            subscriptionDate: item.subscriptionDate,
            expirationDate: item.expirationDate,
            status: item.subscriptionStatus,
            plan: item.planId
        }))
    };
};

const createRenewal = async (partnerId) => {
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

    const plan = subscription.planId;
    if (!plan || plan.status !== 'ACTIVE') {
        throw new AppError('Your current plan is no longer available for renewal', 409);
    }

    const existing = await Transaction.findOne({
        partnerId,
        subscriptionId: subscription._id,
        transactionType: 'SUBSCRIPTION_PAYMENT',
        status: { $in: ['PENDING', 'PROCESSING'] },
        'metadata.operation': 'RENEW',
        expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (existing) {
        return { payment: getPaymentDetails(existing), reused: true };
    }

    const now = new Date();
    const previousExpirationDate = new Date(subscription.expirationDate);
    const targetStartDate = previousExpirationDate > now ? previousExpirationDate : now;
    const targetEndDate = new Date(targetStartDate.getTime() + Number(plan.durationDays) * DAY_MS);
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
        description: `Renew ${plan.planName} subscription`,
        metadata: {
            operation: 'RENEW',
            planId: plan._id,
            planName: plan.planName,
            durationDays: plan.durationDays,
            previousExpirationDate,
            targetStartDate,
            targetEndDate,
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
            'metadata.operation': 'RENEW',
            expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 });
        if (!concurrentPayment) throw error;
        return { payment: getPaymentDetails(concurrentPayment), reused: true };
    }

    return { payment: getPaymentDetails(transaction), reused: false };
};

const getRenewalStatus = async (partnerId, transactionId) => {
    if (!mongoose.isValidObjectId(transactionId)) {
        throw new AppError('Invalid transaction ID', 400);
    }

    const transaction = await Transaction.findOne({
        _id: transactionId,
        partnerId,
        transactionType: 'SUBSCRIPTION_PAYMENT',
        'metadata.operation': 'RENEW'
    });

    if (!transaction) {
        throw new AppError('Renewal transaction not found', 404);
    }

    if (transaction.status === 'PENDING' && transaction.expiresAt <= new Date()) {
        transaction.status = 'EXPIRED';
        await transaction.save();
    }

    const subscription = transaction.status === 'SUCCESS'
        ? await PartnerSubscription.findById(transaction.subscriptionId)
            .populate('planId', 'planName code durationDays')
            .lean()
        : null;

    return {
        ...getPaymentDetails(transaction),
        subscription: subscription ? {
            status: subscription.subscriptionStatus,
            subscriptionDate: subscription.subscriptionDate,
            expirationDate: subscription.expirationDate,
            plan: subscription.planId
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
            'metadata.operation': 'RENEW'
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

const fulfillRenewal = async (transaction) => {
    const existingHistory = await SubscriptionHistory.findOne({ transactionId: transaction._id }).lean();
    if (existingHistory) {
        return existingHistory;
    }

    const metadata = transaction.metadata || {};
    const previousExpirationDate = new Date(metadata.previousExpirationDate);
    const targetStartDate = new Date(metadata.targetStartDate);
    const targetEndDate = new Date(metadata.targetEndDate);

    if (
        !metadata.planId
        || [previousExpirationDate, targetStartDate, targetEndDate].some((date) => Number.isNaN(date.getTime()))
    ) {
        throw new AppError('Renewal transaction metadata is incomplete', 409);
    }

    const subscription = await PartnerSubscription.findOne({
        _id: transaction.subscriptionId,
        partnerId: transaction.partnerId,
        planId: metadata.planId
    });
    if (!subscription) {
        throw new AppError('The subscription linked to this renewal no longer exists', 409);
    }

    const currentExpiration = new Date(subscription.expirationDate);
    if (currentExpiration.getTime() !== previousExpirationDate.getTime()) {
        if (currentExpiration >= targetEndDate) {
            return SubscriptionHistory.findOneAndUpdate(
                { transactionId: transaction._id },
                {
                    $setOnInsert: {
                        partnerId: transaction.partnerId,
                        planId: metadata.planId,
                        transactionId: transaction._id,
                        subscriptionDate: targetStartDate,
                        expirationDate: targetEndDate,
                        subscriptionStatus: 'ACTIVE'
                    }
                },
                { upsert: true, returnDocument: 'after' }
            );
        }
        throw new AppError('The subscription changed while this renewal was awaiting payment', 409);
    }

    subscription.subscriptionStatus = 'ACTIVE';
    subscription.subscriptionDate = targetStartDate;
    subscription.expirationDate = targetEndDate;
    subscription.cancelledAt = null;
    await subscription.save();

    return SubscriptionHistory.findOneAndUpdate(
        { transactionId: transaction._id },
        {
            $setOnInsert: {
                partnerId: transaction.partnerId,
                planId: metadata.planId,
                transactionId: transaction._id,
                subscriptionDate: targetStartDate,
                expirationDate: targetEndDate,
                subscriptionStatus: 'ACTIVE'
            }
        },
        { upsert: true, returnDocument: 'after' }
    );
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
    createRenewal,
    getRenewalStatus,
    cancelRenewal,
    fulfillRenewal
};
