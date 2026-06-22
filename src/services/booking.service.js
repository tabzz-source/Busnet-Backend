const crypto = require("crypto");

const Trip = require("../models/Trip");
const Booking = require("../models/Booking");
const BookingSeat = require("../models/BookingSeat");
const Transaction = require("../models/Transaction");
const PartnerInformation = require("../models/PartnerInformation");

const AppError = require("../utils/AppError");
const { generateUniqueBookingCode } = require("../utils/bookingCode");


const HOLD_MINUTES = 10;

const generateHoldToken = () => crypto.randomBytes(16).toString("hex");

const buildPaymentContent = (bookingCode) => bookingCode;

const buildQrUrl = ({
  bankCode,
  accountNumber,
  accountName,
  amount,
  content,
}) => {
  const baseUrl = process.env.VIETQR_BASE_URL || "https://img.vietqr.io/image";

  if (!bankCode || !accountNumber) {
    return null;
  }

  const encodedAmount = encodeURIComponent(amount);
  const encodedContent = encodeURIComponent(content);
  const encodedAccountName = encodeURIComponent(accountName || "");

  return `${baseUrl}/${bankCode}-${accountNumber}-compact2.png?amount=${encodedAmount}&addInfo=${encodedContent}&accountName=${encodedAccountName}`;
};

const normalizeSeatCodes = (seatCodes) => {
  if (!Array.isArray(seatCodes)) {
    throw new AppError("seatCodes must be an array", 400);
  }

  const normalized = seatCodes
    .map((seatCode) => String(seatCode || "").trim())
    .filter(Boolean);

  const unique = [...new Set(normalized)];

  if (unique.length === 0) {
    throw new AppError("Please select at least one seat", 400);
  }

  if (unique.length !== normalized.length) {
    throw new AppError("Duplicate seat codes are not allowed", 400);
  }

  return unique;
};

const validateRequiredBookingInput = (payload) => {
  const requiredFields = [
    "tripId",
    "pickupPoint_name",
    "pickupPoint_address",
    "pickupPoint_time",
    "dropoffPoint_name",
    "dropoffPoint_address",
    "dropoffPoint_time",
    "passengerName",
    "passengerPhone",
  ];

  for (const field of requiredFields) {
    if (!payload[field] || String(payload[field]).trim() === "") {
      throw new AppError(`${field} is required`, 400);
    }
  }
};

const cleanupFailedBooking = async ({
  tripId,
  holdToken,
  seatCount,
  bookingId,
  transactionId,
}) => {
  if (transactionId) {
    await Transaction.deleteOne({ _id: transactionId });
  }

  if (bookingId) {
    await BookingSeat.deleteMany({ bookingId });
    await Booking.deleteOne({ _id: bookingId });
  }

  if (tripId && holdToken && seatCount > 0) {
    await Trip.updateOne(
      {
        _id: tripId,
        "seats.holdToken": holdToken,
      },
      {
        $set: {
          "seats.$[seat].status": "AVAILABLE",
          "seats.$[seat].bookingId": null,
          "seats.$[seat].holdToken": null,
          "seats.$[seat].lockedUntil": null,
        },
        $inc: {
          availableSeats: seatCount,
          heldSeats: -seatCount,
        },
      },
      {
        arrayFilters: [
          {
            "seat.holdToken": holdToken,
            "seat.status": "HELD",
          },
        ],
      },
    );
  }
};

const getPartnerPaymentInfo = async (partnerId) => {
  const partnerInfo = await PartnerInformation.findOne({
    accountId: partnerId,
  }).lean();

  if (!partnerInfo) {
    return {
      bankCode: process.env.DEFAULT_SEPAY_BANK_CODE || null,
      accountNumber: process.env.DEFAULT_SEPAY_ACCOUNT_NUMBER || null,
      accountName: process.env.DEFAULT_SEPAY_ACCOUNT_NAME || null,
      raw: null,
    };
  }

  return {
    bankCode:
      partnerInfo.sepayBankCode ||
      partnerInfo.bankCode ||
      partnerInfo.bankName ||
      process.env.DEFAULT_SEPAY_BANK_CODE ||
      null,

    accountNumber:
      partnerInfo.sepayAccountNumber ||
      partnerInfo.bankNumber ||
      partnerInfo.bankAccountNumber ||
      process.env.DEFAULT_SEPAY_ACCOUNT_NUMBER ||
      null,

    accountName:
      partnerInfo.bankAccountName ||
      partnerInfo.accountName ||
      process.env.DEFAULT_SEPAY_ACCOUNT_NAME ||
      null,

    raw: partnerInfo,
  };
};

const createBooking = async (customerId, payload) => {
  validateRequiredBookingInput(payload);

  const seatCodes = normalizeSeatCodes(payload.seatCodes);
  const seatCount = seatCodes.length;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);
  const holdToken = generateHoldToken();

  let booking = null;
  let transaction = null;

  const trip = await Trip.findById(payload.tripId).lean();

  if (!trip) {
    throw new AppError("Trip not found", 404);
  }

  if (trip.status !== "OPEN") {
    throw new AppError("Trip is not open for booking", 400);
  }

  const selectedSeats = trip.seats.filter((seat) =>
    seatCodes.includes(seat.seatCode),
  );

  if (selectedSeats.length !== seatCodes.length) {
    throw new AppError("Some selected seats do not exist in this trip", 400);
  }

  const unavailableSeat = selectedSeats.find(
    (seat) => seat.status !== "AVAILABLE",
  );

  if (unavailableSeat) {
    throw new AppError(
      `Seat ${unavailableSeat.seatCode} is not available`,
      409,
    );
  }

  const total = selectedSeats.reduce(
    (sum, seat) => sum + Number(seat.price || 0),
    0,
  );

  if (total <= 0) {
    throw new AppError("Invalid booking total", 400);
  }

  const holdResult = await Trip.updateOne(
    {
      _id: trip._id,
      status: "OPEN",
      "seats.seatCode": { $all: seatCodes },
      seats: {
        $not: {
          $elemMatch: {
            seatCode: { $in: seatCodes },
            status: { $ne: "AVAILABLE" },
          },
        },
      },
    },
    {
      $set: {
        "seats.$[seat].status": "HELD",
        "seats.$[seat].holdToken": holdToken,
        "seats.$[seat].lockedUntil": expiresAt,
        "seats.$[seat].bookingId": null,
      },
      $inc: {
        availableSeats: -seatCount,
        heldSeats: seatCount,
      },
    },
    {
      arrayFilters: [
        {
          "seat.seatCode": { $in: seatCodes },
          "seat.status": "AVAILABLE",
        },
      ],
    },
  );

  if (holdResult.modifiedCount !== 1) {
    throw new AppError("Some seats are no longer available", 409);
  }

  try {
    const bookingCode = await generateUniqueBookingCode();
    const paymentContent = buildPaymentContent(bookingCode);

    booking = await Booking.create({
      bookingCode,
      customerId,
      partnerId: trip.partnerId,
      tripId: trip._id,

      pickupPoint_name: payload.pickupPoint_name,
      pickupPoint_address: payload.pickupPoint_address,
      pickupPoint_time: payload.pickupPoint_time,

      dropoffPoint_name: payload.dropoffPoint_name,
      dropoffPoint_address: payload.dropoffPoint_address,
      dropoffPoint_time: payload.dropoffPoint_time,

      total,
      status: "PENDING_PAYMENT",

      passengerName: payload.passengerName,
      passengerPhone: payload.passengerPhone,
      passengerEmail: payload.passengerEmail || null,
      customerNote: payload.customerNote || "",

      payment_amount: total,
      payment_status: "PENDING",
      payment_paymentType: "SEPAY",

      expiresAt,
    });

    await Trip.updateOne(
      {
        _id: trip._id,
        "seats.holdToken": holdToken,
      },
      {
        $set: {
          "seats.$[seat].bookingId": booking._id,
        },
      },
      {
        arrayFilters: [
          {
            "seat.holdToken": holdToken,
            "seat.status": "HELD",
          },
        ],
      },
    );

    const bookingSeats = selectedSeats.map((seat) => ({
      bookingId: booking._id,
      seatCode: seat.seatCode,
      seatType: seat.seatType || "STANDARD",
      price: seat.price,
      discount: 0,
      finalPrice: seat.price,
      passengerName: payload.passengerName,
    }));

    await BookingSeat.insertMany(bookingSeats);

    transaction = await Transaction.create({
      partnerId: trip.partnerId,
      senderAccountId: customerId,
      bookingId: booking._id,
      transactionType: "BOOKING_PAYMENT",
      amount: total,
      currency: "VND",
      status: "PENDING",
      expiresAt,
      gateway: "SEPAY",
      code: bookingCode,
      content: paymentContent,
      transferAmount: 0,
      description: `Payment for booking ${bookingCode}`,
      metadata: {
        bookingCode,
        holdToken,
        seatCodes,
      },
    });

    booking.payment_transactionId = transaction._id;
    await booking.save();

    const paymentInfo = await getPartnerPaymentInfo(trip.partnerId);

    const qrUrl = buildQrUrl({
      bankCode: paymentInfo.bankCode,
      accountNumber: paymentInfo.accountNumber,
      accountName: paymentInfo.accountName,
      amount: total,
      content: paymentContent,
    });

    return {
      booking: {
        id: booking._id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        payment_status: booking.payment_status,
        total: booking.total,
        expiresAt: booking.expiresAt,
      },
      seats: bookingSeats,
      payment: {
        transactionId: transaction._id,
        amount: total,
        currency: "VND",
        gateway: "SEPAY",
        content: paymentContent,
        bankCode: paymentInfo.bankCode,
        accountNumber: paymentInfo.accountNumber,
        accountName: paymentInfo.accountName,
        qrUrl,
        expiresAt,
      },
      serverTime: now,
    };
  } catch (error) {
    await cleanupFailedBooking({
      tripId: trip._id,
      holdToken,
      seatCount,
      bookingId: booking?._id,
      transactionId: transaction?._id,
    });

    throw error;
  }
};

const getMyBookings = async (customerId, query = {}) => {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const filter = {
        customerId
    };

    if (query.status) {
        filter.status = String(query.status).trim().toUpperCase();
    }

    if (query.payment_status) {
        filter.payment_status = String(query.payment_status).trim().toUpperCase();
    }

    const [bookings, totalItems] = await Promise.all([
        Booking.find(filter)
            .populate({
                path: 'tripId',
                select: 'tripCode departureDate actualDepartureTime actualArrivalTime status'
            })
            .populate({
                path: 'partnerId',
                select: 'fullName email phone profilePicture'
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),

        Booking.countDocuments(filter)
    ]);

    return {
        bookings,
        pagination: {
            totalItems,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: page,
            limit
        }
    };
};

const getBookingByCodeForCustomer = async (customerId, bookingCode) => {
    const booking = await Booking.findOne({
        bookingCode: String(bookingCode || '').trim().toUpperCase(),
        customerId
    })
        .populate({
            path: 'tripId',
            select: 'tripCode departureDate actualDepartureTime actualArrivalTime status routeId scheduleId busId partnerId',
            populate: [
                {
                    path: 'routeId',
                    select: 'routeName originProvince originDistrict destinationProvince destinationDistrict distanceKm estimatedDuration'
                },
                {
                    path: 'scheduleId',
                    select: 'scheduleCode departureTime arrivalTime recurrenceType'
                },
                {
                    path: 'busId',
                    select: 'busName busType totalSeats licensePlate images'
                }
            ]
        })
        .populate({
            path: 'partnerId',
            select: 'fullName email phone profilePicture'
        });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    return booking;
};

const getBookingDetail = async (customerId, bookingCode) => {
    const booking = await getBookingByCodeForCustomer(customerId, bookingCode);

    const [seats, transaction] = await Promise.all([
        BookingSeat.find({ bookingId: booking._id }).lean(),
        Transaction.findOne({ bookingId: booking._id }).lean()
    ]);

    return {
        booking,
        seats,
        transaction
    };
};

const getBookingStatus = async (customerId, bookingCode) => {
    const booking = await Booking.findOne({
        bookingCode: String(bookingCode || '').trim().toUpperCase(),
        customerId
    })
        .select('bookingCode status payment_status total payment_amount expiresAt confirmedAt cancelledAt createdAt updatedAt')
        .lean();

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    return {
        bookingCode: booking.bookingCode,
        status: booking.status,
        payment_status: booking.payment_status,
        total: booking.total,
        payment_amount: booking.payment_amount,
        expiresAt: booking.expiresAt,
        confirmedAt: booking.confirmedAt,
        cancelledAt: booking.cancelledAt,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        serverTime: new Date()
    };
};

const getBookingPayment = async (customerId, bookingCode) => {
    const booking = await Booking.findOne({
        bookingCode: String(bookingCode || '').trim().toUpperCase(),
        customerId
    });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    const transaction = await Transaction.findOne({ bookingId: booking._id });

    if (!transaction) {
        throw new AppError('Transaction not found', 404);
    }

    const paymentInfo = await getPartnerPaymentInfo(booking.partnerId);

    const qrUrl = buildQrUrl({
        bankCode: paymentInfo.bankCode,
        accountNumber: paymentInfo.accountNumber,
        accountName: paymentInfo.accountName,
        amount: transaction.amount,
        content: transaction.content
    });

    return {
        booking: {
            bookingCode: booking.bookingCode,
            status: booking.status,
            payment_status: booking.payment_status,
            total: booking.total,
            expiresAt: booking.expiresAt
        },
        payment: {
            transactionId: transaction._id,
            status: transaction.status,
            amount: transaction.amount,
            currency: transaction.currency,
            gateway: transaction.gateway,
            content: transaction.content,
            bankCode: paymentInfo.bankCode,
            accountNumber: paymentInfo.accountNumber,
            accountName: paymentInfo.accountName,
            qrUrl,
            expiresAt: transaction.expiresAt
        },
        serverTime: new Date()
    };
};

const releaseHeldSeatsForBooking = async (booking) => {
    const bookingSeats = await BookingSeat.find({ bookingId: booking._id }).lean();
    const seatCodes = bookingSeats.map((seat) => seat.seatCode);

    if (seatCodes.length === 0) {
        return {
            releasedSeatCodes: [],
            releasedCount: 0
        };
    }

    const result = await Trip.updateOne(
        {
            _id: booking.tripId
        },
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
                    'seat.seatCode': { $in: seatCodes },
                    'seat.bookingId': booking._id,
                    'seat.status': 'HELD'
                }
            ]
        }
    );

    return {
        releasedSeatCodes: seatCodes,
        releasedCount: result.modifiedCount === 1 ? seatCodes.length : 0
    };
};

const expireStaleBookings = async () => {
    const now = new Date();

    const staleBookings = await Booking.find({
        status: 'PENDING_PAYMENT',
        payment_status: 'PENDING',
        expiresAt: { $lte: now }
    }).limit(100);

    const results = [];

    for (const booking of staleBookings) {
        const releaseResult = await releaseHeldSeatsForBooking(booking);

        await Transaction.updateMany(
            {
                bookingId: booking._id,
                status: 'PENDING'
            },
            {
                $set: {
                    status: 'EXPIRED'
                }
            }
        );

        booking.payment_status = 'EXPIRED';
        await booking.save();

        results.push({
            bookingCode: booking.bookingCode,
            releasedSeatCodes: releaseResult.releasedSeatCodes,
            releasedCount: releaseResult.releasedCount
        });
    }

    return {
        expiredCount: results.length,
        results
    };
};

const cancelBooking = async (customerId, bookingCode, reason = '') => {
    const booking = await Booking.findOne({
        bookingCode: String(bookingCode || '').trim().toUpperCase(),
        customerId
    });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    if (['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_OPERATOR', 'REFUNDED'].includes(booking.status)) {
        throw new AppError('Booking has already been cancelled', 400);
    }

    if (booking.status === 'COMPLETED') {
        throw new AppError('Completed booking cannot be cancelled', 400);
    }

    if (booking.status === 'PENDING_PAYMENT' && booking.payment_status === 'PENDING') {
        const releaseResult = await releaseHeldSeatsForBooking(booking);

        booking.status = 'CANCELLED_BY_CUSTOMER';
        booking.payment_status = 'CANCELLED';
        booking.cancelReason = reason;
        booking.cancelledAt = new Date();

        await booking.save();

        await Transaction.updateMany(
            {
                bookingId: booking._id,
                status: 'PENDING'
            },
            {
                $set: {
                    status: 'CANCELLED'
                }
            }
        );

        return {
            bookingCode: booking.bookingCode,
            status: booking.status,
            payment_status: booking.payment_status,
            releasedSeatCodes: releaseResult.releasedSeatCodes,
            releasedCount: releaseResult.releasedCount
        };
    }

    if (booking.status === 'CONFIRMED' && booking.payment_status === 'PAID') {
        booking.status = 'CANCEL_REQUESTED';
        booking.cancelReason = reason;
        booking.cancelledAt = new Date();

        await booking.save();

        return {
            bookingCode: booking.bookingCode,
            status: booking.status,
            payment_status: booking.payment_status,
            message: 'Cancellation request submitted. Refund will be handled manually.'
        };
    }

    throw new AppError('Booking cannot be cancelled in current status', 400);
};

module.exports = {
    createBooking,
    getMyBookings,
    getBookingDetail,
    getBookingStatus,
    getBookingPayment,
    releaseHeldSeatsForBooking,
    expireStaleBookings,
    cancelBooking,
    cleanupFailedBooking
};