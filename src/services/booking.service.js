const crypto = require('crypto');

const Account = require('../models/Account');
const Booking = require('../models/Booking');
const BookingSeat = require('../models/BookingSeat');
const PartnerInformation = require('../models/PartnerInformation');
const Ticket = require('../models/Ticket');
const Transaction = require('../models/Transaction');
const Trip = require('../models/Trip');
const AppError = require('../utils/AppError');
const {
    generateUniqueBookingCode,
    extractBookingCodeFromContent,
    isValidBookingCode
} = require('../utils/bookingCode');
const { booking: bookingEnv } = require('../config/env');
const tripService = require('./trip.service');
const paymentService = require('./payment.service');

const normalizeSeatCodes = (seatCodes) =>
    [...new Set((seatCodes || []).map((seatCode) => String(seatCode).trim()).filter(Boolean))];

const normalizeAmount = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
};

const buildPaymentContent = (bookingCode) => {
    const prefix = String(bookingEnv.paymentContentPrefix || 'BUSNET').trim();
    return `${prefix}${prefix.endsWith(' ') ? '' : ' '}${bookingCode}`;
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
    const bankName = partnerInfo?.bankName || partnerInfo?.operatorName || null;
    const bankCode = partnerInfo?.bankCode || partnerInfo?.sepayBankCode || null;
    const bankNumber = partnerInfo?.bankNumber || partnerInfo?.sepayAccountNumber || null;
    const bankAccountName = partnerInfo?.bankAccountName || partnerInfo?.operatorName || null;
    const content = transaction?.content || buildPaymentContent(booking.bookingCode);

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

const cleanupFailedBooking = async ({
    tripId,
    holdToken,
    bookingId,
    bookingSeatIds = [],
    transactionId = null,
    reason = 'Booking creation failed'
}) => {
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

        const requestedAmount = normalizeAmount(payload.amount);
        if (requestedAmount !== null && requestedAmount !== total) {
            throw new AppError('Requested amount does not match booking total', 400);
        }

        const bookingCode = await generateUniqueBookingCode();
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

        await Booking.updateOne(
            { _id: bookingDoc._id },
            {
                $set: {
                    expiresAt: holdExpiresAt
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

        const content = buildPaymentContent(bookingDoc.bookingCode);

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

        return formatBookingResponse({
            booking: {
                ...bookingDoc.toObject(),
                payment_transactionId: transaction._id,
                payment_paymentType: payment.gateway,
                payment_amount: total,
                expiresAt: holdExpiresAt
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

const getBookingRecord = async (accountId, bookingCode) => {
    const normalizedCode = String(bookingCode || '').trim().toUpperCase();

    const booking = await Booking.findOne({
        bookingCode: normalizedCode,
        customerId: accountId
    }).lean();

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    return booking;
};

const getBookingTransaction = async (booking) => {
    if (!booking?.payment_transactionId) {
        return null;
    }

    return Transaction.findById(booking.payment_transactionId)
        .select('status gateway amount content expiresAt transactionDate transferAmount sepayTransactionId metadata code description referenceCode')
        .lean();
};

const getBookingStatus = async (accountId, bookingCode) => {
    const booking = await getBookingRecord(accountId, bookingCode);
    const transaction = await getBookingTransaction(booking);

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
                  transactionDate: transaction.transactionDate,
                  transferAmount: transaction.transferAmount,
                  sepayTransactionId: transaction.sepayTransactionId
              }
            : null
    };
};

const getBookingPayment = async (accountId, bookingCode) => {
    const booking = await getBookingRecord(accountId, bookingCode);
    const [bookingSeats, transaction, trip] = await Promise.all([
        BookingSeat.find({ bookingId: booking._id }).sort({ createdAt: 1 }).lean(),
        getBookingTransaction(booking),
        Trip.findById(booking.tripId)
            .populate('routeId', 'routeName origin_provinceName origin_districtName destination_provinceName destination_districtName distanceKm estimatedDuration')
            .populate('scheduleId', 'scheduleCode departureTime arrivalTime recurrenceType')
            .populate('partnerId', 'fullName status profilePicture')
            .lean()
    ]);

    const partnerInfo = trip?.partnerId
        ? await PartnerInformation.findOne({ accountId: trip.partnerId._id || trip.partnerId })
              .select('bankName bankCode bankAccountName bankNumber sepayBankCode sepayAccountNumber operatorName')
              .lean()
        : null;

    return {
        booking: {
            bookingId: booking._id,
            bookingCode: booking.bookingCode,
            status: booking.status,
            paymentStatus: booking.payment_status,
            total: booking.total,
            paymentAmount: booking.payment_amount,
            expiresAt: booking.expiresAt,
            confirmedAt: booking.confirmedAt,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt
        },
        seats: bookingSeats.map((seat) => ({
            seatCode: seat.seatCode,
            seatType: seat.seatType,
            price: seat.price,
            discount: seat.discount,
            finalPrice: seat.finalPrice
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
        payment: {
            transactionId: transaction?._id || null,
            status: transaction?.status || booking.payment_status,
            gateway: transaction?.gateway || 'SEPAY',
            amount: transaction?.amount || booking.total,
            transferAmount: transaction?.transferAmount || null,
            content: transaction?.content || buildPaymentContent(booking.bookingCode),
            qrUrl:
                partnerInfo && booking.payment_status === 'PENDING'
                    ? paymentService.generateSepayQrUrl({
                          bankName: partnerInfo.bankName || partnerInfo.operatorName,
                          bankNumber: partnerInfo.bankNumber || partnerInfo.sepayAccountNumber,
                          bankAccountName: partnerInfo.bankAccountName || partnerInfo.operatorName,
                          amount: booking.total,
                          content: transaction?.content || buildPaymentContent(booking.bookingCode)
                      })
                    : null
        }
    };
};

const getBookingDetail = async (accountId, bookingCode) => {
    const booking = await getBookingRecord(accountId, bookingCode);

    const [bookingSeats, transaction, trip] = await Promise.all([
        BookingSeat.find({ bookingId: booking._id }).sort({ createdAt: 1 }).lean(),
        getBookingTransaction(booking),
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

const getBookingTickets = async (accountId, bookingCode) => {
    const booking = await getBookingRecord(accountId, bookingCode);

    if (booking.payment_status !== 'PAID' && booking.status !== 'CONFIRMED') {
        throw new AppError('Booking is not paid yet', 409);
    }

    const tickets = await Ticket.find({ bookingId: booking._id }).sort({ createdAt: 1 }).lean();

    return {
        bookingCode: booking.bookingCode,
        bookingStatus: booking.status,
        paymentStatus: booking.payment_status,
        tickets: tickets.map((ticket) => ({
            ticketId: ticket._id,
            ticketCode: ticket.ticketCode,
            seatCode: ticket.seatCode,
            status: ticket.status,
            issuedAt: ticket.issuedAt,
            ticketExpiredAt: ticket.ticketExpiredAt
        }))
    };
};

const buildSepayBookingCode = (payload = {}) => {
    const candidates = [
        payload?.code,
        payload?.transactionCode,
        payload?.description,
        payload?.content,
        payload?.memo,
        payload?.remark
    ];

    for (const candidate of candidates) {
        const parsed = extractBookingCodeFromContent(candidate);
        if (parsed) return parsed;
        if (isValidBookingCode(candidate)) return String(candidate).trim().toUpperCase();
    }

    return null;
};

const createTicketsForBooking = async ({ booking, bookingSeats }) => {
    if (!booking || !Array.isArray(bookingSeats) || bookingSeats.length === 0) {
        return [];
    }

    const existingTickets = await Ticket.find({ bookingId: booking._id }).select('_id seatCode ticketCode').lean();
    const existingSeatCodes = new Set(existingTickets.map((ticket) => String(ticket.seatCode)));
    const missingSeats = bookingSeats.filter((seat) => !existingSeatCodes.has(String(seat.seatCode)));

    if (missingSeats.length === 0) {
        return existingTickets;
    }

    const ticketDocs = missingSeats.map((seat, index) => ({
        bookingId: booking._id,
        tripId: booking.tripId,
        seatCode: seat.seatCode,
        ticketCode: `${booking.bookingCode}-${seat.seatCode || index}`,
        status: 'ISSUED',
        issuedAt: new Date(),
        ticketExpiredAt: booking.expiresAt || null
    }));

    const createdTickets = await Ticket.insertMany(ticketDocs);
    return [...existingTickets, ...createdTickets];
};

const markTripSeatsBooked = async ({ tripId, bookingId, seatCodes, session = null }) => {
    const uniqueSeatCodes = normalizeSeatCodes(seatCodes);
    const trip = await Trip.findOne({
        _id: tripId,
        'seats.seatCode': { $all: uniqueSeatCodes }
    })
        .select('seats')
        .session(session)
        .lean();

    if (!trip) {
        throw new AppError('Trip not found for booking confirmation', 404);
    }

    const targetedSeats = trip.seats.filter((seat) => uniqueSeatCodes.includes(seat.seatCode));
    const alreadyBooked = targetedSeats.every((seat) => seat.status === 'BOOKED' && String(seat.bookingId || '') === String(bookingId));
    if (alreadyBooked) {
        return true;
    }

    const eligibleSeats = targetedSeats.every(
        (seat) => seat.status === 'HELD' && String(seat.bookingId || '') === String(bookingId)
    );

    if (!eligibleSeats) {
        throw new AppError('Trip seats are no longer available for confirmation', 409);
    }

    const update = await Trip.updateOne(
        {
            _id: tripId,
            'seats.seatCode': { $all: uniqueSeatCodes }
        },
        {
            $set: {
                'seats.$[seat].status': 'BOOKED',
                'seats.$[seat].bookingId': bookingId,
                'seats.$[seat].holdToken': null,
                'seats.$[seat].lockedUntil': null
            },
            $inc: {
                bookedSeats: uniqueSeatCodes.length,
                heldSeats: -uniqueSeatCodes.length
            }
        },
        {
            arrayFilters: [{ 'seat.seatCode': { $in: uniqueSeatCodes } }],
            session
        }
    );

    if (update.modifiedCount !== 1) {
        throw new AppError('Failed to mark trip seats as booked', 500);
    }
};

const finalizePaidBooking = async ({ booking, transaction, bookingSeats, webhookPayload }) => {
    if (booking.payment_status === 'PAID' && booking.status === 'CONFIRMED') {
        return {
            bookingCode: booking.bookingCode,
            bookingStatus: booking.status,
            paymentStatus: booking.payment_status,
            transactionId: transaction?._id || null,
            alreadyProcessed: true
        };
    }

    const seatCodes = bookingSeats.map((seat) => seat.seatCode);
    const paidAt = new Date();
    let effectiveTransaction = transaction;

    if (!effectiveTransaction) {
        const created = await Transaction.create([
            {
                partnerId: booking.partnerId,
                senderAccountId: booking.customerId,
                bookingId: booking._id,
                transactionType: 'BOOKING_PAYMENT',
                amount: booking.total,
                currency: 'VND',
                status: 'PENDING',
                expiresAt: booking.expiresAt || null,
                gateway: 'SEPAY',
                code: booking.bookingCode,
                content: webhookPayload.content || buildPaymentContent(booking.bookingCode),
                description: `Thanh toan dat ve ${booking.bookingCode}`
            }
        ]);

        effectiveTransaction = created[0];
    }

    await Promise.all([
        Transaction.updateOne(
            { _id: effectiveTransaction._id },
            {
                $set: {
                    status: 'SUCCESS',
                    transferAmount: webhookPayload.transferAmount ?? booking.total,
                    sepayTransactionId: webhookPayload.sepayTransactionId || webhookPayload.referenceCode || null,
                    code: webhookPayload.code || booking.bookingCode,
                    content: webhookPayload.content || buildPaymentContent(booking.bookingCode),
                    description: webhookPayload.description || transaction?.description || '',
                    referenceCode: webhookPayload.referenceCode || transaction?.referenceCode || null,
                    transactionDate: webhookPayload.transactionDate
                        ? new Date(webhookPayload.transactionDate)
                        : transaction?.transactionDate || paidAt,
                    metadata: {
                        ...(transaction?.metadata || {}),
                        webhook: webhookPayload
                    }
                }
            }
        ),
        Booking.updateOne(
            { _id: booking._id },
            {
                $set: {
                    status: 'CONFIRMED',
                    payment_status: 'PAID',
                    confirmedAt: booking.confirmedAt || paidAt,
                    payment_amount: booking.total,
                    payment_paymentType: effectiveTransaction.gateway || 'SEPAY',
                    payment_transactionId: effectiveTransaction._id
                }
            }
        ),
        markTripSeatsBooked({
            tripId: booking.tripId,
            bookingId: booking._id,
            seatCodes
        })
    ]);

    const tickets = await createTicketsForBooking({
        booking: {
            ...booking,
            confirmedAt: booking.confirmedAt || paidAt
        },
        bookingSeats
    });

    return {
        bookingCode: booking.bookingCode,
        bookingStatus: 'CONFIRMED',
        paymentStatus: 'PAID',
        transactionId: effectiveTransaction._id,
        ticketsCreated: tickets.length
    };
};

const handleSepayWebhook = async (payload = {}) => {
    const bookingCode = buildSepayBookingCode(payload);
    if (!bookingCode) {
        throw new AppError('bookingCode not found in webhook payload', 400);
    }

    const booking = await Booking.findOne({ bookingCode }).lean();
    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    const bookingSeats = await BookingSeat.find({ bookingId: booking._id }).sort({ createdAt: 1 }).lean();
    const transaction = booking.payment_transactionId
        ? await Transaction.findById(booking.payment_transactionId).lean()
        : await Transaction.findOne({ bookingId: booking._id }).lean();

    const transferAmount = normalizeAmount(payload.transferAmount ?? payload.amount ?? payload.money);
    if (transferAmount !== null && transferAmount < Number(booking.total || 0)) {
        throw new AppError('Transfer amount is lower than booking total', 400);
    }

    if (booking.payment_status === 'PAID' && booking.status === 'CONFIRMED') {
        await Promise.all([
            markTripSeatsBooked({
                tripId: booking.tripId,
                bookingId: booking._id,
                seatCodes: bookingSeats.map((seat) => seat.seatCode)
            }).catch(() => null),
            createTicketsForBooking({
                booking,
                bookingSeats
            }).catch(() => null)
        ]);

        return {
            bookingCode,
            bookingStatus: booking.status,
            paymentStatus: booking.payment_status,
            alreadyProcessed: true
        };
    }

    const result = await finalizePaidBooking({
        booking,
        transaction,
        bookingSeats,
        webhookPayload: {
            ...payload,
            bookingCode,
            transferAmount
        }
    });

    return result;
};

const expireBookingByCode = async (bookingCode) => {
    const booking = await Booking.findOne({ bookingCode: String(bookingCode || '').trim().toUpperCase() }).lean();
    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    if (booking.payment_status === 'PAID' || booking.status === 'CONFIRMED') {
        return {
            bookingCode: booking.bookingCode,
            skipped: true
        };
    }

    const bookingSeats = await BookingSeat.find({ bookingId: booking._id }).sort({ createdAt: 1 }).lean();
    const transaction = booking.payment_transactionId
        ? await Transaction.findById(booking.payment_transactionId).lean()
        : await Transaction.findOne({ bookingId: booking._id }).lean();

    const seatCodes = bookingSeats.map((seat) => seat.seatCode);
    if (seatCodes.length > 0) {
        await Trip.updateOne(
            { _id: booking.tripId },
            {
                $set: {
                    'seats.$[seat].status': 'AVAILABLE',
                    'seats.$[seat].bookingId': null,
                    'seats.$[seat].holdToken': null,
                    'seats.$[seat].lockedUntil': null
                },
                $inc: {
                    availableSeats: seatCodes.length,
                    heldSeats: -seatCodes.length
                }
            },
            {
                arrayFilters: [
                    {
                        'seat.bookingId': booking._id,
                        'seat.status': 'HELD'
                    }
                ]
            }
        );
    }

    await Promise.all([
        Booking.updateOne(
            { _id: booking._id },
            {
                $set: {
                    payment_status: 'EXPIRED'
                }
            }
        ),
        transaction
            ? Transaction.updateOne(
                  { _id: transaction._id },
                  {
                      $set: {
                          status: 'EXPIRED'
                      }
                  }
              )
            : Promise.resolve()
    ]);

    return {
        bookingCode: booking.bookingCode,
        paymentStatus: 'EXPIRED'
    };
};

const getBookingByPaymentCode = async (bookingCode) => {
    const normalizedCode = String(bookingCode || '').trim().toUpperCase();

    const booking = await Booking.findOne({ bookingCode: normalizedCode }).lean();
    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    return booking;
};

const getBookingPaymentForCode = async (bookingCode) => {
    const booking = await getBookingByPaymentCode(bookingCode);
    const bookingSeats = await BookingSeat.find({ bookingId: booking._id }).sort({ createdAt: 1 }).lean();
    const transaction = await getBookingTransaction(booking);
    const trip = await Trip.findById(booking.tripId)
        .populate('routeId', 'routeName origin_provinceName origin_districtName destination_provinceName destination_districtName distanceKm estimatedDuration')
        .populate('scheduleId', 'scheduleCode departureTime arrivalTime recurrenceType')
        .populate('partnerId', 'fullName status profilePicture')
        .lean();

    const partnerInfo = trip?.partnerId
        ? await PartnerInformation.findOne({ accountId: trip.partnerId._id || trip.partnerId })
              .select('bankName bankCode bankAccountName bankNumber sepayBankCode sepayAccountNumber operatorName')
              .lean()
        : null;

    return formatBookingResponse({
        booking,
        bookingSeats,
        transaction,
        qrUrl:
            partnerInfo && booking.payment_status === 'PENDING'
                ? paymentService.generateSepayQrUrl({
                      bankName: partnerInfo.bankName || partnerInfo.operatorName,
                      bankNumber: partnerInfo.bankNumber || partnerInfo.sepayAccountNumber,
                      bankAccountName: partnerInfo.bankAccountName || partnerInfo.operatorName,
                      amount: booking.total,
                      content: transaction?.content || buildPaymentContent(booking.bookingCode)
                  })
                : null,
        serverTime: new Date().toISOString(),
        partnerInfo
    });
};

const expireStaleBookings = async (limit = 100) => {
    const now = new Date();
    const staleBookings = await Booking.find({
        payment_status: 'PENDING',
        expiresAt: { $ne: null, $lte: now }
    })
        .sort({ expiresAt: 1 })
        .limit(limit)
        .lean();

    const results = [];
    for (const booking of staleBookings) {
        results.push(await expireBookingByCode(booking.bookingCode));
    }

    return {
        processed: results.length,
        results
    };
};

module.exports = {
    createBookingWithPayment,
    getBookingStatus,
    getBookingDetail,
    getBookingPayment,
    getBookingTickets,
    handleSepayWebhook,
    expireBookingByCode,
    expireStaleBookings,
    getBookingPaymentForCode,
    buildSepayBookingCode
};
