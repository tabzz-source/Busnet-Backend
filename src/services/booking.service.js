const crypto = require('crypto');
const Account = require('../models/Account');
const Booking = require('../models/Booking');
const BookingSeat = require('../models/BookingSeat');
const PartnerInformation = require('../models/PartnerInformation');
const Transaction = require('../models/Transaction');
const Trip = require('../models/Trip');
const AppError = require('../utils/AppError');
const generateCode = require('../utils/generateCode');
const { booking: bookingEnv } = require('../config/env');
const tripService = require('./trip.service');
const paymentService = require('./payment.service');

const normalizeSeatCodes = (seatCodes) => [...new Set((seatCodes || []).map((seatCode) => String(seatCode).trim()).filter(Boolean))];

const buildBookingCode = () => {
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
    return `${bookingEnv.codePrefix}${datePart}${generateCode(4)}`;
};

const getBookingAccount = async (accountId) => {
    const account = await Account.findOne({
        _id: accountId,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        deletedAt: null
    }).lean();

    if (!account) {
        throw new AppError('Customer account not found', 404);
    }

    return account;
};

const getPartnerPaymentProfile = async (partnerId) => {
    const partnerInfo = await PartnerInformation.findOne({ accountId: partnerId }).lean();

    if (!partnerInfo) {
        throw new AppError('Partner information not found', 404);
    }

    const bankCode = partnerInfo.bankCode || partnerInfo.sepayBankCode;
    const bankNumber = partnerInfo.bankNumber || partnerInfo.sepayAccountNumber;
    const bankAccountName = partnerInfo.bankAccountName || partnerInfo.operatorName;

    if (!partnerInfo.paymentEnabled || partnerInfo.paymentSetupStatus !== 'READY') {
        throw new AppError('Partner payment is not enabled', 409);
    }

    if (!bankCode || !bankNumber || !bankAccountName) {
        throw new AppError('Partner bank information is incomplete', 400);
    }

    return {
        ...partnerInfo,
        bankCode,
        bankNumber,
        bankAccountName
    };
};

const createBookingSeatSnapshots = (bookingId, selectedSeats) =>
    selectedSeats.map((seat) => ({
        bookingId,
        seatCode: seat.seatCode,
        seatType: seat.seatType || 'STANDARD',
        price: seat.price,
        discount: 0,
        finalPrice: seat.price,
        passengerName: null
    }));

const formatBookingResponse = ({ booking, bookingSeats, transaction, qrUrl, serverTime, partnerInfo }) => {
    const bankName = partnerInfo.bankName || partnerInfo.operatorName;
    const bankCode = partnerInfo.bankCode || partnerInfo.sepayBankCode;
    const bankNumber = partnerInfo.bankNumber || partnerInfo.sepayAccountNumber;
    const bankAccountName = partnerInfo.bankAccountName || partnerInfo.operatorName;
    const content = transaction?.content || null;

    return {
        booking: {
            bookingId: booking._id,
            bookingCode: booking.bookingCode,
            status: booking.status,
            paymentStatus: booking.payment_status,
            total: booking.total,
            expiresAt: booking.expiresAt,
            confirmedAt: booking.confirmedAt,
            tripId: booking.tripId,
            paymentTransactionId: booking.payment_transactionId
        },
        seats: bookingSeats.map((seat) => ({
            seatCode: seat.seatCode,
            seatType: seat.seatType,
            price: seat.price,
            discount: seat.discount,
            finalPrice: seat.finalPrice
        })),
        payment: {
            transactionId: transaction?._id || null,
            gateway: transaction?.gateway || 'SEPAY',
            bankName,
            bankCode,
            bankNumber,
            bankAccountName,
            amount: transaction?.amount || booking.total,
            content,
            qrUrl
        },
        serverTime
    };
};

const cleanupFailedBooking = async ({ tripId, holdToken, bookingId, bookingSeatIds = [], transactionId = null, reason = 'Booking creation failed' }) => {
    await tripService.releaseSeatsByHoldToken({ tripId, holdToken }).catch(() => null);

    if (bookingSeatIds.length > 0) {
        await BookingSeat.deleteMany({ _id: { $in: bookingSeatIds } }).catch(() => null);
    }

    if (transactionId) {
        await Transaction.updateOne(
            { _id: transactionId },
            {
                $set: {
                    status: 'CANCELLED'
                }
            }
        ).catch(() => null);
    }

    if (bookingId) {
        await Booking.updateOne(
            { _id: bookingId },
            {
                $set: {
                    status: 'CANCELLED_BY_OPERATOR',
                    payment_status: 'CANCELLED',
                    cancelledAt: new Date(),
                    cancelReason: reason,
                    cancelResponse: 'Cancelled automatically because booking flow failed'
                }
            }
        ).catch(() => null);
    }
};

const createBookingWithPayment = async (accountId, payload) => {
    const holdToken = `hold_${crypto.randomUUID()}`;
    let tripId = null;
    let bookingId = null;
    let bookingSeatIds = [];
    let transactionId = null;

    try {
        const customer = await getBookingAccount(accountId);
        const seatCodes = normalizeSeatCodes(payload.seatCodes);
        if (seatCodes.length === 0) {
            throw new AppError('seatCodes is required', 400);
        }

        tripId = payload.tripId;
        const holdExpiresAt = new Date(Date.now() + bookingEnv.holdMinutes * 60 * 1000);
        const heldResult = await tripService.holdTripSeats({
            tripId,
            seatCodes,
            holdToken,
            lockedUntil: holdExpiresAt
        });

        const trip = heldResult.trip;
        const selectedSeats = heldResult.seats;
        const partnerInfo = await getPartnerPaymentProfile(trip.partnerId);

        const total = selectedSeats.reduce((sum, seat) => sum + Number(seat.price || 0), 0);
        if (total <= 0) {
            throw new AppError('Unable to calculate booking total', 400);
        }

        const bookingCode = buildBookingCode();
        const bookingDoc = await Booking.create({
            bookingCode,
            customerId: customer._id,
            partnerId: trip.partnerId,
            tripId: trip._id,
            pickupPoint_name: payload.pickupPoint_name,
            pickupPoint_address: payload.pickupPoint_address,
            pickupPoint_time: payload.pickupPoint_time,
            dropoffPoint_name: payload.dropoffPoint_name,
            dropoffPoint_address: payload.dropoffPoint_address,
            dropoffPoint_time: payload.dropoffPoint_time,
            total,
            status: 'PENDING_PAYMENT',
            passengerName: payload.passengerName,
            passengerPhone: payload.passengerPhone,
            passengerEmail: payload.passengerEmail || null,
            customerNote: payload.customerNote || '',
            payment_amount: 0,
            payment_status: 'PENDING',
            expiresAt: holdExpiresAt
        });
        bookingId = bookingDoc._id;

        const bookingExpiresAt = new Date(new Date(bookingDoc.createdAt).getTime() + bookingEnv.holdMinutes * 60 * 1000);
        await Booking.updateOne(
            { _id: bookingDoc._id },
            {
                $set: {
                    expiresAt: bookingExpiresAt
                }
            }
        );

        await tripService.attachBookingIdToHeldSeats({
            tripId: trip._id,
            bookingId: bookingDoc._id,
            holdToken,
            seatCodes
        });

        const bookingSeatSnapshots = createBookingSeatSnapshots(bookingDoc._id, selectedSeats);
        const bookingSeatDocs = await BookingSeat.insertMany(bookingSeatSnapshots);
        bookingSeatIds = bookingSeatDocs.map((seat) => seat._id);

        const paymentContentPrefix = bookingEnv.paymentContentPrefix.endsWith(' ')
            ? bookingEnv.paymentContentPrefix
            : `${bookingEnv.paymentContentPrefix} `;
        const content = `${paymentContentPrefix}${bookingDoc.bookingCode}`;

        const { transaction, qrUrl, payment } = await paymentService.createBookingPaymentTransaction({
            booking: bookingDoc,
            partnerInfo,
            amount: total,
            content,
            senderAccountId: customer._id
        });

        transactionId = transaction._id;

        await Booking.updateOne(
            { _id: bookingDoc._id },
            {
                $set: {
                    payment_transactionId: transaction._id,
                    payment_paymentType: payment.gateway,
                    payment_amount: total
                }
            }
        );

        bookingDoc.expiresAt = bookingExpiresAt;

        return formatBookingResponse({
            booking: {
                ...bookingDoc.toObject(),
                payment_transactionId: transaction._id,
                payment_paymentType: payment.gateway,
                payment_amount: total,
                expiresAt: bookingExpiresAt
            },
            bookingSeats: bookingSeatDocs,
            transaction,
            qrUrl,
            serverTime: new Date().toISOString(),
            partnerInfo
        });
    } catch (error) {
        if (tripId) {
            await cleanupFailedBooking({
                tripId,
                holdToken,
                bookingId,
                bookingSeatIds,
                transactionId,
                reason: error.message || 'Booking creation failed'
            });
        }

        throw error;
    }
};

const getBookingStatus = async (accountId, bookingCode) => {
    const booking = await Booking.findOne({
        bookingCode,
        customerId: accountId
    })
        .select(
            'bookingCode status payment_status total expiresAt confirmedAt cancelledAt payment_amount payment_transactionId tripId createdAt updatedAt'
        )
        .lean();

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    const transaction = booking.payment_transactionId
        ? await Transaction.findById(booking.payment_transactionId)
              .select('status gateway amount content expiresAt transactionDate')
              .lean()
        : null;

    return {
        bookingCode: booking.bookingCode,
        status: booking.status,
        paymentStatus: booking.payment_status,
        total: booking.total,
        paymentAmount: booking.payment_amount,
        expiresAt: booking.expiresAt,
        confirmedAt: booking.confirmedAt,
        cancelledAt: booking.cancelledAt,
        transaction: transaction
            ? {
                  transactionId: transaction._id,
                  status: transaction.status,
                  gateway: transaction.gateway,
                  amount: transaction.amount,
                  content: transaction.content,
                  expiresAt: transaction.expiresAt,
                  transactionDate: transaction.transactionDate
              }
            : null
    };
};

const getBookingDetail = async (accountId, bookingCode) => {
    const booking = await Booking.findOne({
        bookingCode,
        customerId: accountId
    })
        .lean();

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    const [bookingSeats, transaction, trip] = await Promise.all([
        BookingSeat.find({ bookingId: booking._id }).sort({ createdAt: 1 }).lean(),
        booking.payment_transactionId
            ? await Transaction.findById(booking.payment_transactionId)
                  .select('status gateway amount content expiresAt transactionDate metadata')
                  .lean()
            : null,
        Trip.findById(booking.tripId)
            .populate('routeId', 'routeName origin_provinceName origin_districtName destination_provinceName destination_districtName distanceKm estimatedDuration')
            .populate('scheduleId', 'scheduleCode departureTime arrivalTime recurrenceType')
            .populate('partnerId', 'fullName status profilePicture')
            .lean()
    ]);

    return {
        booking: {
            bookingId: booking._id,
            bookingCode: booking.bookingCode,
            status: booking.status,
            paymentStatus: booking.payment_status,
            total: booking.total,
            passengerName: booking.passengerName,
            passengerPhone: booking.passengerPhone,
            passengerEmail: booking.passengerEmail,
            pickupPoint: {
                name: booking.pickupPoint_name,
                address: booking.pickupPoint_address,
                time: booking.pickupPoint_time
            },
            dropoffPoint: {
                name: booking.dropoffPoint_name,
                address: booking.dropoffPoint_address,
                time: booking.dropoffPoint_time
            },
            expiresAt: booking.expiresAt,
            confirmedAt: booking.confirmedAt,
            cancelledAt: booking.cancelledAt,
            customerNote: booking.customerNote,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt
        },
        seats: bookingSeats.map((seat) => ({
            seatCode: seat.seatCode,
            seatType: seat.seatType,
            price: seat.price,
            discount: seat.discount,
            finalPrice: seat.finalPrice,
            passengerName: seat.passengerName
        })),
        trip: trip
            ? {
                  tripId: trip._id,
                  tripCode: trip.tripCode,
                  departureDate: trip.departureDate,
                  departureTime: trip.actualDepartureTime,
                  arrivalTime: trip.actualArrivalTime,
                  route: trip.routeId,
                  schedule: trip.scheduleId,
                  partner: trip.partnerId
              }
            : null,
        transaction: transaction
            ? {
                  transactionId: transaction._id,
                  status: transaction.status,
                  gateway: transaction.gateway,
                  amount: transaction.amount,
                  content: transaction.content,
                  expiresAt: transaction.expiresAt,
                  transactionDate: transaction.transactionDate,
                  metadata: transaction.metadata
              }
            : null
    };
};

module.exports = {
    createBookingWithPayment,
    getBookingStatus,
    getBookingDetail
};
