const mongoose = require('mongoose');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const Schedule = require('../models/Schedule');
const Trip = require('../models/Trip');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const Feedback = require('../models/Feedback');

const toObjectId = (partnerId) => new mongoose.Types.ObjectId(partnerId);

const getPartnerStats = async (partnerId) => {
    const partnerObjectId = toObjectId(partnerId);
    const [
        totalBuses,
        totalRoutes,
        totalSchedules,
        totalTrips,
        totalBookings,
        confirmedBookings,
        revenueResult,
        feedbackResult
    ] = await Promise.all([
        Bus.countDocuments({ partnerId, isActive: true }),
        Route.countDocuments({ partnerId, isActive: true, deletedAt: null }),
        Schedule.countDocuments({ partnerId, isActive: true }),
        Trip.countDocuments({ partnerId }),
        Booking.countDocuments({ partnerId }),
        Booking.countDocuments({ partnerId, status: 'CONFIRMED' }),
        Transaction.aggregate([
            { $match: { partnerId: partnerObjectId, status: 'SUCCESS', transactionType: 'BOOKING_PAYMENT' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]),
        Feedback.aggregate([
            { $match: { partnerId: partnerObjectId, status: 'VISIBLE' } },
            {
                $group: {
                    _id: null,
                    avgRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 }
                }
            }
        ])
    ]);

    const revenue = revenueResult[0]?.total || 0;
    const avgRating = feedbackResult[0]?.avgRating ? Math.round(feedbackResult[0].avgRating * 10) / 10 : 0;
    const totalReviews = feedbackResult[0]?.totalReviews || 0;

    return {
        totalBuses,
        totalRoutes,
        totalSchedules,
        totalTrips,
        totalBookings,
        confirmedBookings,
        revenue,
        avgRating,
        totalReviews
    };
};

const getRevenueChart = async (partnerId, months = 6) => {
    const partnerObjectId = toObjectId(partnerId);
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const result = await Transaction.aggregate([
        {
            $match: {
                partnerId: partnerObjectId,
                status: 'SUCCESS',
                transactionType: 'BOOKING_PAYMENT',
                transactionDate: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$transactionDate' },
                    month: { $month: '$transactionDate' }
                },
                revenue: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const chart = [];
    for (let i = 0; i < months; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const found = result.find(r => r._id.year === year && r._id.month === month);
        chart.push({
            month: `${year}-${String(month).padStart(2, '0')}`,
            label: date.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
            revenue: found?.revenue || 0,
            bookings: found?.count || 0
        });
    }

    return chart;
};

const getBookingStatusBreakdown = async (partnerId) => {
    const partnerObjectId = toObjectId(partnerId);
    const result = await Booking.aggregate([
        { $match: { partnerId: partnerObjectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);

    return result.map(item => ({
        status: item._id,
        count: item.count
    }));
};

const getRecentBookings = async (partnerId, limit = 5) => {
    return Booking.find({ partnerId })
        .populate('customerId', 'fullName email phone')
        .populate('tripId', 'tripCode departureDate')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
};

const getUpcomingTrips = async (partnerId, limit = 5) => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const currentMinute = now.getHours() * 60 + now.getMinutes();

    return Trip.find({
        partnerId,
        status: { $in: ['OPEN', 'DELAYED'] },
        $or: [
            { departureDate: { $gte: startOfTomorrow } },
            {
                departureDate: { $gte: startOfToday, $lt: startOfTomorrow },
                actualDepartureTime: { $gte: currentMinute }
            }
        ]
    })
        .populate('routeId', 'routeName origin_provinceName destination_provinceName')
        .populate('busId', 'busName licensePlate busType')
        .sort({ departureDate: 1 })
        .limit(limit)
        .lean();
};

module.exports = {
    getPartnerStats,
    getRevenueChart,
    getBookingStatusBreakdown,
    getRecentBookings,
    getUpcomingTrips
};
