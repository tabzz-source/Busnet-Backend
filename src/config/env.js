const toNumber = (value, fallback) => {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};

module.exports = {
    booking: {
        holdMinutes: toNumber(process.env.BOOKING_HOLD_MINUTES, 10),
        codePrefix: process.env.BOOKING_CODE_PREFIX || 'BKG',
        paymentContentPrefix: process.env.PAYMENT_CONTENT_PREFIX || 'BUSNET',
        vietQrImageBaseUrl: process.env.VIETQR_IMAGE_BASE_URL || 'https://img.vietqr.io/image',
        vietQrTemplate: process.env.VIETQR_TEMPLATE || 'compact2',
        sepayQrBaseUrl: process.env.SEPAY_QR_BASE_URL || 'https://qr.sepay.vn/img',
        sepayQrTemplate: process.env.SEPAY_QR_TEMPLATE || 'compact'
    }
};
