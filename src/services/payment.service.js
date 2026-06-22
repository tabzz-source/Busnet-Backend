const Transaction = require('../models/Transaction');
const AppError = require('../utils/AppError');
const { booking: bookingEnv } = require('../config/env');

const normalizeAccountName = (value) => String(value || '').trim();

const generateSepayQrUrl = ({
    bankName,
    bankNumber,
    amount,
    content,
    bankAccountName,
    template = bookingEnv.sepayQrTemplate || 'compact',
    baseUrl = bookingEnv.sepayQrBaseUrl || 'https://qr.sepay.vn/img'
}) => {
    const normalizedBank = String(bankName || '').trim();
    const normalizedAccount = String(bankNumber || '').replace(/\s+/g, '').trim();
    const normalizedHolder = normalizeAccountName(bankAccountName).toUpperCase();
    const safeAmount = Math.round(Number(amount));

    if (!normalizedBank || !normalizedAccount || !normalizedHolder) {
        throw new AppError('Partner bank information is incomplete for SePay QR', 400);
    }

    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
        throw new AppError('Invalid payment amount', 400);
    }

    const params = new URLSearchParams({
        bank: normalizedBank,
        acc: normalizedAccount,
        template: String(template || 'compact').trim(),
        showinfo: 'true',
        holder: normalizedHolder,
        amount: String(safeAmount)
    });

    if (content) {
        params.set('des', String(content).trim());
    }

    return `${String(baseUrl || 'https://qr.sepay.vn/img').replace(/\/$/, '')}?${params.toString()}`;
};

const createBookingPaymentTransaction = async ({
    booking,
    partnerInfo,
    amount,
    content,
    senderAccountId,
    session = null
}) => {
    if (!booking) {
        throw new AppError('Booking is required to create payment transaction', 400);
    }

    const bankName = partnerInfo?.bankName || partnerInfo?.operatorName;
    const bankCode = partnerInfo?.bankCode || partnerInfo?.sepayBankCode;
    const bankNumber = partnerInfo?.bankNumber || partnerInfo?.sepayAccountNumber;
    const bankAccountName = partnerInfo?.bankAccountName || partnerInfo?.operatorName;

    if (!bankName || !bankNumber || !bankAccountName) {
        throw new AppError('Partner bank information is incomplete', 400);
    }

    const transaction = await Transaction.create(
        [
            {
                partnerId: booking.partnerId,
                senderAccountId,
                bookingId: booking._id,
                transactionType: 'BOOKING_PAYMENT',
                amount,
                currency: 'VND',
                status: 'PENDING',
                expiresAt: booking.expiresAt,
                gateway: 'SEPAY',
                accountNumber: bankNumber,
                code: booking.bookingCode,
                content,
                description: `Thanh toan dat ve ${booking.bookingCode}`,
                metadata: {
                    bankName,
                    bankCode,
                    bankNumber,
                    bankAccountName,
                    qrProvider: 'SEPAY_QR'
                }
            }
        ],
        session ? { session } : {}
    );

    const createdTransaction = transaction[0];
    const qrUrl = generateSepayQrUrl({
        bankName,
        bankNumber,
        amount,
        content,
        bankAccountName
    });

    return {
        transaction: createdTransaction,
        qrUrl,
        payment: {
            gateway: 'SEPAY',
            bankName,
            bankCode,
            bankNumber,
            bankAccountName,
            amount,
            content,
            qrUrl
        }
    };
};

module.exports = {
    generateSepayQrUrl,
    createBookingPaymentTransaction
};
