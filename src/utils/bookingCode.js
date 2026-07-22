/**
 * utils/bookingCode.js
 *
 * Sinh và kiểm tra "bookingCode" — đồng thời là mã thanh toán dùng để
 * đối chiếu giao dịch SePay với đơn đặt vé.
 *
 * ⚠️ QUAN TRỌNG — phải khớp với cấu hình trên SePay Dashboard:
 *   Cấu hình Công ty → Cấu hình chung → Cấu trúc mã thanh toán
 *     - Tiền tố (Prefix): BNT
 *     - Hậu tố (Suffix):  7 ký tự, loại "Số và chữ" (alphanumeric)
 *
 * => Tổng độ dài mã: BNT + 7 ký tự = 10 ký tự. Ví dụ: BNT4F9K2X7
 *
 * Nếu bạn đổi PREFIX hoặc SUFFIX_LENGTH bên dưới, nhớ cập nhật lại
 * đúng cấu hình tương ứng trên SePay, nếu không webhook sẽ không
 * nhận diện được mã và không bắn về (khi đã bật "Chỉ gửi khi có mã thanh toán").
 */

const crypto = require('crypto');
const Booking = require('../models/Booking');
const AppError = require('./AppError');

const BOOKING_CODE_PREFIX = 'BNT';
const SUFFIX_LENGTH = 7;
const MAX_GENERATE_RETRIES = 5;

// Bỏ các ký tự dễ gây nhầm lẫn khi đọc bằng mắt: 0/O, 1/I/L
// (đây là lựa chọn để mã dễ đọc hơn, không phải yêu cầu bắt buộc từ SePay)
const SAFE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const BOOKING_CODE_REGEX = new RegExp(`^${BOOKING_CODE_PREFIX}[${SAFE_ALPHABET}]{${SUFFIX_LENGTH}}$`);

/**
 * Sinh ngẫu nhiên 1 chuỗi hậu tố an toàn bằng crypto.randomBytes
 * (tránh dùng Math.random() cho dữ liệu liên quan đến giao dịch tiền).
 */
const generateRandomSuffix = (length) => {
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += SAFE_ALPHABET[bytes[i] % SAFE_ALPHABET.length];
    }
    return result;
};

/**
 * Sinh 1 bookingCode mới, đảm bảo duy nhất trong collection Booking.
 * Retry tối đa MAX_GENERATE_RETRIES lần nếu trùng (xác suất trùng cực thấp
 * với SAFE_ALPHABET 31 ký tự ^ 7 ~ 27 tỷ tổ hợp, nhưng vẫn cần check để chắc chắn).
 *
 * @param {Object} options
 * @param {import('mongoose').ClientSession} [options.session] - Mongo session nếu đang chạy trong transaction
 * @returns {Promise<string>} bookingCode duy nhất, vd: "BNT4F9K2X7"
 */
const generateUniqueBookingCode = async ({ session = null } = {}) => {
    for (let attempt = 0; attempt < MAX_GENERATE_RETRIES; attempt++) {
        const candidate = `${BOOKING_CODE_PREFIX}${generateRandomSuffix(SUFFIX_LENGTH)}`;

        const query = Booking.exists({ bookingCode: candidate });
        if (session) query.session(session);
        const exists = await query;

        if (!exists) return candidate;
    }

    throw new AppError('Không thể sinh mã đơn hàng duy nhất, vui lòng thử lại', 500);
};

/**
 * Kiểm tra 1 chuỗi có đúng định dạng bookingCode hay không.
 * Dùng để validate input từ client, hoặc kiểm tra trường `code`
 * SePay trả về trong webhook có hợp lệ không.
 */
const isValidBookingCode = (code) => BOOKING_CODE_REGEX.test(String(code || '').trim().toUpperCase());

/**
 * Tách bookingCode ra khỏi nội dung chuyển khoản tự do (content).
 * Dùng làm FALLBACK khi:
 *   - Chưa cấu hình "Cấu trúc mã thanh toán" trên SePay, hoặc
 *   - SePay không tách được mã vào trường `code` (code = null)
 *
 * Ngân hàng thường thêm tiền tố lạ vào nội dung (vd "BUI ANH TUAN chuyen tien BNT4F9K2X7"),
 * nên cần regex tìm theo PATTERN thay vì so khớp chính xác toàn chuỗi.
 */
const extractBookingCodeFromContent = (content) => {
    if (!content) return null;
    const match = String(content)
        .toUpperCase()
        .match(new RegExp(`${BOOKING_CODE_PREFIX}[${SAFE_ALPHABET}]{${SUFFIX_LENGTH}}`));
    return match ? match[0] : null;
};

module.exports = {
    BOOKING_CODE_PREFIX,
    SUFFIX_LENGTH,
    generateUniqueBookingCode,
    isValidBookingCode,
    extractBookingCodeFromContent
};