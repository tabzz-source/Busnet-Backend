const crypto = require("crypto");

const Trip = require("../models/Trip");
const Booking = require("../models/Booking");
const BookingSeat = require("../models/BookingSeat");
const Transaction = require("../models/Transaction");
const Account = require("../models/Account");
const PartnerInformation = require("../models/PartnerInformation");
const Ticket = require("../models/Ticket");

const AppError = require("../utils/AppError");
const emailService = require("./email.service");
const { generateSepayQrUrl } = require("./payment.service");
const {
  generateUniqueBookingCode,
  isValidBookingCode,
  extractBookingCodeFromContent,
} = require("../utils/bookingCode");

const HOLD_MINUTES = 10;
const CUSTOMER_CANCEL_CUTOFF_HOURS = 3;
const CUSTOMER_CANCEL_CUTOFF_MS = CUSTOMER_CANCEL_CUTOFF_HOURS * 60 * 60 * 1000;

const generateHoldToken = () => crypto.randomBytes(16).toString("hex");

const buildPaymentContent = (bookingCode) => bookingCode;

const getTripDateTime = (departureDate, minutes, addNextDay = false) => {
  const date = new Date(departureDate);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(minutes);

  if (addNextDay) {
    date.setDate(date.getDate() + 1);
  }

  return date;
};

const getTripArrivalDateTime = (trip) => {
  if (!trip || trip.actualArrivalTime === null || trip.actualArrivalTime === undefined) {
    return null;
  }

  const depMinutes = Number(trip.actualDepartureTime || 0);
  const arrMinutes = Number(trip.actualArrivalTime);

  if (!Number.isFinite(arrMinutes)) {
    return null;
  }

  return getTripDateTime(trip.departureDate, arrMinutes, arrMinutes < depMinutes);
};

const formatMinutesToClock = (minutes) => {
  const totalMinutes = Number(minutes);

  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return null;
  }

  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mins = String(totalMinutes % 60).padStart(2, "0");

  return `${hours}:${mins}`;
};

const sanitizePdfText = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");

const escapePdfText = (value) =>
  sanitizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const wrapPdfText = (value, maxLength = 92) => {
  const text = sanitizePdfText(value).trim();

  if (!text) {
    return [""];
  }

  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length <= maxLength) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    if (word.length > maxLength) {
      for (let index = 0; index < word.length; index += maxLength) {
        const chunk = word.slice(index, index + maxLength);
        if (chunk.length === maxLength) {
          lines.push(chunk);
        } else {
          currentLine = chunk;
        }
      }
      if (word.length % maxLength === 0) {
        currentLine = "";
      }
    } else {
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const qrGfMultiply = (x, y) => {
  let result = 0;
  while (y > 0) {
    if (y & 1) result ^= x;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
    y >>= 1;
  }
  return result;
};

const qrReedSolomonDivisor = (degree) => {
  let result = [1];
  let root = 1;

  for (let i = 0; i < degree; i += 1) {
    const next = new Array(result.length + 1).fill(0);
    for (let j = 0; j < result.length; j += 1) {
      next[j] ^= qrGfMultiply(result[j], root);
      next[j + 1] ^= result[j];
    }
    result = next;
    root = qrGfMultiply(root, 2);
  }

  return result;
};

const qrReedSolomonRemainder = (data, degree) => {
  const divisor = qrReedSolomonDivisor(degree);
  const result = new Array(degree).fill(0);

  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);

    for (let i = 0; i < degree; i += 1) {
      result[i] ^= qrGfMultiply(divisor[i], factor);
    }
  }

  return result;
};

const appendBits = (bits, value, length) => {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
};

const buildQrMatrix = (value) => {
  const version = 4;
  const size = version * 4 + 17;
  const dataCodewords = 80;
  const eccCodewords = 20;
  const bytes = Buffer.from(String(value || ""), "utf8").slice(0, 70);
  const bits = [];

  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) appendBits(bits, byte, 8);
  appendBits(bits, 0, Math.min(4, dataCodewords * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((sum, bit) => (sum << 1) | bit, 0));
  }
  for (let pad = 0xec; data.length < dataCodewords; pad ^= 0xec ^ 0x11) {
    data.push(pad);
  }

  const allCodewords = [...data, ...qrReedSolomonRemainder(data, eccCodewords)];
  const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const setModule = (x, y, dark, reserve = true) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    matrix[y][x] = Boolean(dark);
    if (reserve) reserved[y][x] = true;
  };

  const drawFinder = (x, y) => {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const xx = x + dx;
        const yy = y + dy;
        const dark =
          dx >= 0 &&
          dx <= 6 &&
          dy >= 0 &&
          dy <= 6 &&
          (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        setModule(xx, yy, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  for (let i = 8; i < size - 8; i += 1) {
    setModule(i, 6, i % 2 === 0);
    setModule(6, i, i % 2 === 0);
  }

  const drawAlignment = (cx, cy) => {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        setModule(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  };
  drawAlignment(26, 26);

  for (let i = 0; i < 9; i += 1) {
    setModule(8, i, false);
    setModule(i, 8, false);
    setModule(size - 1 - i, 8, false);
    setModule(8, size - 1 - i, false);
  }
  setModule(8, size - 8, true);

  const dataBits = [];
  for (const codeword of allCodewords) appendBits(dataBits, codeword, 8);

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vert = 0; vert < size; vert += 1) {
      const y = upward ? size - 1 - vert : vert;
      for (let dx = 0; dx < 2; dx += 1) {
        const x = right - dx;
        if (reserved[y][x]) continue;
        const rawBit = bitIndex < dataBits.length ? dataBits[bitIndex] === 1 : false;
        bitIndex += 1;
        const mask = (x + y) % 2 === 0;
        matrix[y][x] = rawBit !== mask;
      }
    }
    upward = !upward;
  }

  const formatBits = "111011111000100";
  const formatCoordsA = [
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8],
    [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  ];
  const formatCoordsB = [
    [8, size - 1], [8, size - 2], [8, size - 3], [8, size - 4], [8, size - 5], [8, size - 6], [8, size - 7],
    [size - 8, 8], [size - 7, 8], [size - 6, 8], [size - 5, 8], [size - 4, 8], [size - 3, 8], [size - 2, 8], [size - 1, 8],
  ];
  formatCoordsA.forEach(([x, y], index) => setModule(x, y, formatBits[index] === "1"));
  formatCoordsB.forEach(([x, y], index) => setModule(x, y, formatBits[index] === "1"));

  return matrix.map((row) => row.map(Boolean));
};

const pdfColor = (hex) => {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
};

const pdfText = (text, x, y, size = 10, color = "#0f172a") => [
  "BT",
  `${pdfColor(color)} rg`,
  `/F1 ${size} Tf`,
  `1 0 0 1 ${x} ${y} Tm`,
  `(${escapePdfText(text)}) Tj`,
  "ET",
].join("\n");

const pdfRect = (x, y, width, height, color = "#ffffff") =>
  `${pdfColor(color)} rg\n${x} ${y} ${width} ${height} re f`;

const pdfStrokeRect = (x, y, width, height, color = "#e2e8f0", lineWidth = 1) =>
  `${pdfColor(color)} RG\n${lineWidth} w\n${x} ${y} ${width} ${height} re S`;

const pdfQr = (value, x, y, size) => {
  const matrix = buildQrMatrix(value);
  const quietModules = 4;
  const moduleSize = size / (matrix.length + quietModules * 2);
  const commands = [pdfRect(x, y, size, size, "#ffffff")];

  matrix.forEach((row, rowIndex) => {
    row.forEach((dark, colIndex) => {
      if (!dark) return;
      const moduleX = x + (colIndex + quietModules) * moduleSize;
      const moduleY = y + size - (rowIndex + quietModules + 1) * moduleSize;
      commands.push(`${pdfColor("#111827")} rg\n${moduleX.toFixed(2)} ${moduleY.toFixed(2)} ${moduleSize.toFixed(2)} ${moduleSize.toFixed(2)} re f`);
    });
  });

  return commands.join("\n");
};

const buildPdfBuffer = (pages) => {
  const header = "%PDF-1.4\n";
  const objects = [];
  const pageCount = pages.length;
  const fontObjectId = pageCount * 2 + 3;

  objects.push({ id: 1, body: "<< /Type /Catalog /Pages 2 0 R >>" });

  const pageKids = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageObjectId = 3 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    pageKids.push(`${pageObjectId} 0 R`);

    objects.push({
      id: pageObjectId,
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    });

    const page = pages[pageIndex];
    let contentStream = page.rawContent;

    if (!contentStream) {
      const contentLines = [];
      contentLines.push("BT");
      contentLines.push("/F1 18 Tf");
      contentLines.push("1 0 0 1 50 790 Tm");
      contentLines.push(`(${escapePdfText(page.title)}) Tj`);

      let y = 765;
      const lineHeight = 14;

      for (const line of page.lines) {
        contentLines.push("/F1 10 Tf");
        contentLines.push(`1 0 0 1 50 ${y} Tm`);
        contentLines.push(`(${escapePdfText(line)}) Tj`);
        y -= lineHeight;
      }

      contentLines.push("ET");
      contentStream = contentLines.join("\n");
    }

    objects.push({
      id: contentObjectId,
      body: `<< /Length ${Buffer.byteLength(contentStream, "ascii")} >>\nstream\n${contentStream}\nendstream`,
    });
  }

  objects.push({
    id: 2,
    body: `<< /Type /Pages /Kids [${pageKids.join(" ")}] /Count ${pageCount} >>`,
  });

  objects.push({
    id: fontObjectId,
    body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  });

  const orderedObjects = objects.sort((a, b) => a.id - b.id);
  const chunks = [header];
  const offsets = [0];
  let currentOffset = Buffer.byteLength(header, "ascii");

  for (const obj of orderedObjects) {
    const body = `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
    offsets.push(currentOffset);
    chunks.push(body);
    currentOffset += Buffer.byteLength(body, "ascii");
  }

  const xrefOffset = currentOffset;
  const xrefEntries = ["xref", `0 ${orderedObjects.length + 1}`, "0000000000 65535 f "];

  for (let i = 1; i <= orderedObjects.length; i += 1) {
    const offset = String(offsets[i]).padStart(10, "0");
    xrefEntries.push(`${offset} 00000 n `);
  }

  const trailer = [
    "trailer",
    `<< /Size ${orderedObjects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n");

  const pdfString = `${chunks.join("")}${xrefEntries.join("\n")}\n${trailer}`;
  return Buffer.from(pdfString, "ascii");
};

const buildBookingTicketsPdf = async (customerId, bookingCode) => {
  const normalizedCode = String(bookingCode || "").trim().toUpperCase();

  const booking = await Booking.findOne({
    bookingCode: normalizedCode,
    customerId,
  })
    .populate({
      path: "tripId",
      select:
        "tripCode departureDate actualDepartureTime actualArrivalTime routeId partnerId",
      populate: {
        path: "routeId",
        select:
          "routeName origin_provinceName origin_districtName destination_provinceName destination_districtName",
      },
    })
    .lean();

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  if (booking.status !== "CONFIRMED" || booking.payment_status !== "PAID") {
    throw new AppError("Booking must be confirmed and paid before downloading tickets", 400);
  }

  const [tickets, bookingSeats] = await Promise.all([
    Ticket.find({ bookingId: booking._id }).sort({ seatCode: 1 }).lean(),
    BookingSeat.find({ bookingId: booking._id }).sort({ seatCode: 1 }).lean(),
  ]);

  if (tickets.length === 0) {
    throw new AppError("Tickets not found", 404);
  }

  const trip = booking.tripId || {};
  const route = trip.routeId || {};
  const seatMap = new Map(
    bookingSeats.map((seat) => [String(seat.seatCode || "").toUpperCase(), seat]),
  );

  const departureDateText = booking.tripId?.departureDate
    ? new Date(booking.tripId.departureDate).toLocaleDateString("en-GB", {
        timeZone: "Asia/Bangkok",
      })
    : "N/A";

  const departureTimeText = formatMinutesToClock(trip.actualDepartureTime) || "N/A";
  const arrivalTimeText = formatMinutesToClock(trip.actualArrivalTime) || "N/A";
  const routeName = route.routeName || "N/A";
  const fromText = `${route.origin_provinceName || "N/A"}${route.origin_districtName ? `, ${route.origin_districtName}` : ""}`;
  const toText = `${route.destination_provinceName || "N/A"}${route.destination_districtName ? `, ${route.destination_districtName}` : ""}`;
  const totalText = `${Number(booking.total || 0).toLocaleString("en-US")} VND`;
  const pages = tickets.map((ticket, index) => {
    const seat = seatMap.get(String(ticket.seatCode || "").toUpperCase()) || {};
    const qrPayload = [
      "BUSNET_TICKET",
      `ticket=${ticket.ticketCode}`,
      `booking=${booking.bookingCode}`,
      `trip=${trip.tripCode || "N/A"}`,
      `seat=${ticket.seatCode}`,
    ].join("|");
    const content = [];

    content.push(pdfRect(0, 0, 595, 842, "#f8fafc"));
    content.push(pdfRect(0, 764, 595, 78, "#0f4c81"));
    content.push(pdfText("BusNet", 42, 805, 26, "#ffffff"));
    content.push(pdfText("OFFICIAL E-TICKET", 42, 785, 11, "#dbeafe"));
    content.push(pdfText(`Page ${index + 1} of ${tickets.length}`, 480, 805, 10, "#dbeafe"));

    content.push(pdfRect(36, 44, 523, 690, "#ffffff"));
    content.push(pdfStrokeRect(36, 44, 523, 690, "#dbe3ef", 1.2));

    content.push(pdfText(routeName, 58, 704, 20, "#0f172a"));
    content.push(pdfText(`${fromText}  ->  ${toText}`, 58, 684, 11, "#475569"));
    content.push(pdfText(`Ticket Code: ${ticket.ticketCode}`, 58, 650, 12, "#0f4c81"));
    content.push(pdfText(`Booking Code: ${booking.bookingCode}`, 58, 632, 10, "#64748b"));
    content.push(pdfText(`Trip Code: ${trip.tripCode || "N/A"}`, 58, 616, 10, "#64748b"));

    content.push(pdfRect(58, 542, 214, 52, "#eff6ff"));
    content.push(pdfRect(292, 542, 214, 52, "#ecfdf5"));
    content.push(pdfText("DEPARTURE", 72, 574, 9, "#2563eb"));
    content.push(pdfText(`${departureDateText} - ${departureTimeText}`, 72, 554, 14, "#0f172a"));
    content.push(pdfText("ARRIVAL", 306, 574, 9, "#059669"));
    content.push(pdfText(arrivalTimeText, 306, 554, 14, "#0f172a"));

    content.push(pdfText("Passenger", 58, 505, 9, "#94a3b8"));
    content.push(pdfText(booking.passengerName || "N/A", 58, 486, 13, "#0f172a"));
    content.push(pdfText("Phone", 300, 505, 9, "#94a3b8"));
    content.push(pdfText(booking.passengerPhone || "N/A", 300, 486, 13, "#0f172a"));

    content.push(pdfText("Seat", 58, 454, 9, "#94a3b8"));
    content.push(pdfText(`${ticket.seatCode || "N/A"}${seat.seatType ? ` - ${seat.seatType}` : ""}`, 58, 432, 22, "#0f4c81"));
    content.push(pdfText("Ticket Status", 300, 454, 9, "#94a3b8"));
    content.push(pdfText(ticket.status || "ACTIVE", 300, 435, 13, "#0f172a"));

    content.push(pdfText("Pickup", 58, 392, 9, "#94a3b8"));
    wrapPdfText(`${booking.pickupPoint_name || "N/A"} - ${booking.pickupPoint_address || "N/A"} (${booking.pickupPoint_time || "N/A"})`, 68)
      .slice(0, 3)
      .forEach((line, lineIndex) => content.push(pdfText(line, 58, 374 - lineIndex * 15, 10, "#334155")));

    content.push(pdfText("Dropoff", 58, 318, 9, "#94a3b8"));
    wrapPdfText(`${booking.dropoffPoint_name || "N/A"} - ${booking.dropoffPoint_address || "N/A"} (${booking.dropoffPoint_time || "N/A"})`, 68)
      .slice(0, 3)
      .forEach((line, lineIndex) => content.push(pdfText(line, 58, 300 - lineIndex * 15, 10, "#334155")));

    content.push(pdfText("Total Paid", 58, 238, 9, "#94a3b8"));
    content.push(pdfText(totalText, 58, 216, 18, "#0f172a"));

    content.push(pdfRect(356, 210, 150, 150, "#ffffff"));
    content.push(pdfStrokeRect(356, 210, 150, 150, "#cbd5e1", 1));
    content.push(pdfQr(qrPayload, 368, 222, 126));
    content.push(pdfText("Scan this QR at boarding", 363, 190, 10, "#475569"));

    content.push(pdfRect(58, 96, 448, 54, "#f8fafc"));
    content.push(pdfStrokeRect(58, 96, 448, 54, "#e2e8f0", 1));
    content.push(pdfText("Important", 74, 130, 10, "#0f172a"));
    content.push(pdfText("Please arrive at pickup point 15 minutes before departure and present this ticket.", 74, 112, 9, "#475569"));
    content.push(pdfText("This ticket is valid only for the passenger, trip, and seat shown above.", 74, 100, 9, "#475569"));

    return {
      title: `BusNet E-Ticket - ${ticket.ticketCode}`,
      rawContent: content.join("\n"),
    };
  });

  return {
    pdfBuffer: buildPdfBuffer(pages),
    filename: `tickets-${normalizedCode}.pdf`,
  };
};

const extractBookingCodeFromSepayPayload = (payload = {}) => {
  const directCode = String(payload.code || "")
    .trim()
    .toUpperCase();

  if (isValidBookingCode(directCode)) {
    return directCode;
  }

  return (
    extractBookingCodeFromContent(payload.content) ||
    extractBookingCodeFromContent(payload.description)
  );
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
  console.log("\n================ [PAYMENT][GET PARTNER INFO] ================");
  console.log("[PAYMENT][INPUT partnerId]", {
    partnerId,
    partnerIdString: String(partnerId || ""),
  });

  const partnerInfo = await PartnerInformation.findOne({
    accountId: partnerId,
  }).lean();

  console.log("[PAYMENT][PartnerInformation.findOne result]", {
    found: !!partnerInfo,
    partnerInformationId: partnerInfo?._id ? String(partnerInfo._id) : null,
    accountId: partnerInfo?.accountId ? String(partnerInfo.accountId) : null,

    bankName: partnerInfo?.bankName || null,
    bankCode: partnerInfo?.bankCode || null,
    bankNumber: partnerInfo?.bankNumber || null,
    bankAccountName: partnerInfo?.bankAccountName || null,
    bankBranch: partnerInfo?.bankBranch || null,

    sepayBankCode: partnerInfo?.sepayBankCode || null,
    sepayAccountNumber: partnerInfo?.sepayAccountNumber || null,

    paymentEnabled: partnerInfo?.paymentEnabled,
    sepayWebhookEnabled: partnerInfo?.sepayWebhookEnabled,
    paymentSetupStatus: partnerInfo?.paymentSetupStatus || null,
  });

  if (!partnerInfo) {
    console.error("[PAYMENT][ERROR] Partner payment info not found", {
      partnerId: String(partnerId || ""),
      reason:
        "Không tìm thấy PartnerInformation bằng accountId = trip.partnerId / booking.partnerId",
    });

    throw new AppError(
      `Partner payment info not found for partnerId ${partnerId}`,
      400
    );
  }

  const bankCode =
    partnerInfo.sepayBankCode ||
    partnerInfo.bankCode ||
    partnerInfo.bankName;

  const accountNumber =
    partnerInfo.sepayAccountNumber ||
    partnerInfo.bankNumber ||
    partnerInfo.bankAccountNumber;

  const accountName =
    partnerInfo.bankAccountName ||
    partnerInfo.accountName;

  console.log("[PAYMENT][Normalized payment info]", {
    displayBankName: partnerInfo.bankName || bankCode || null,
    bankCode,
    accountNumber,
    accountName,
  });

  if (!bankCode || !accountNumber || !accountName) {
    console.error("[PAYMENT][ERROR] Partner payment information incomplete", {
      bankCode,
      accountNumber,
      accountName,
      partnerInformationId: String(partnerInfo._id),
    });

    throw new AppError("Partner payment information is incomplete", 400);
  }

  return {
    // bankName chỉ dùng để hiển thị cho FE
    bankName: partnerInfo.bankName || bankCode,

    // bankCode mới là mã ngân hàng dùng tạo QR: VPB, VCB, ACB...
    bankCode,

    // giữ cả 2 tên field để FE đang dùng field nào cũng không vỡ
    bankNumber: accountNumber,
    accountNumber,

    bankAccountName: accountName,
    accountName,

    raw: partnerInfo,
  };
};

const createBooking = async (customerId, payload) => {
  console.log("\n================ [BOOKING][CREATE START] ================");
  console.log("[BOOKING][INPUT]", {
    customerId: String(customerId || ""),
    tripId: payload?.tripId,
    seatCodes: payload?.seatCodes,
    passengerName: payload?.passengerName,
    passengerPhone: payload?.passengerPhone,
  });

  validateRequiredBookingInput(payload);

  const seatCodes = normalizeSeatCodes(payload.seatCodes);
  const seatCount = seatCodes.length;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000);
  const holdToken = generateHoldToken();

  let booking = null;
  let transaction = null;

  const trip = await Trip.findById(payload.tripId).lean();

  console.log("[BOOKING][TRIP FOUND]", {
    found: !!trip,
    tripId: trip?._id ? String(trip._id) : null,
    tripCode: trip?.tripCode || null,
    partnerId: trip?.partnerId ? String(trip.partnerId) : null,
    status: trip?.status || null,
    availableSeats: trip?.availableSeats,
    heldSeats: trip?.heldSeats,
    bookedSeats: trip?.bookedSeats,
  });

  if (!trip) {
    throw new AppError("Trip not found", 404);
  }

  if (trip.status !== "OPEN") {
    throw new AppError("Trip is not open for booking", 400);
  }

  const selectedSeats = trip.seats.filter((seat) =>
    seatCodes.includes(seat.seatCode),
  );

  console.log("[BOOKING][SELECTED SEATS]", {
    requestedSeatCodes: seatCodes,
    foundSeatCodes: selectedSeats.map((seat) => seat.seatCode),
    selectedSeats: selectedSeats.map((seat) => ({
      seatCode: seat.seatCode,
      status: seat.status,
      price: seat.price,
      seatType: seat.seatType,
    })),
  });

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

  console.log("[BOOKING][TOTAL]", {
    total,
    seatCount,
  });

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

  console.log("[BOOKING][HOLD RESULT]", {
    acknowledged: holdResult.acknowledged,
    matchedCount: holdResult.matchedCount,
    modifiedCount: holdResult.modifiedCount,
    holdToken,
    expiresAt,
  });

  if (holdResult.modifiedCount !== 1) {
    throw new AppError("Some seats are no longer available", 409);
  }

  try {
    const bookingCode = await generateUniqueBookingCode();
    const paymentContent = buildPaymentContent(bookingCode);

    console.log("[BOOKING][BOOKING CODE]", {
      bookingCode,
      paymentContent,
    });

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

    console.log("[BOOKING][BOOKING CREATED]", {
      bookingId: String(booking._id),
      bookingCode: booking.bookingCode,
      partnerId: String(booking.partnerId),
      tripId: String(booking.tripId),
      total: booking.total,
      payment_status: booking.payment_status,
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

    console.log("[BOOKING][BOOKING SEATS CREATED]", {
      bookingId: String(booking._id),
      seatCodes: bookingSeats.map((seat) => seat.seatCode),
    });

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

    console.log("[BOOKING][TRANSACTION CREATED]", {
      transactionId: String(transaction._id),
      partnerId: String(transaction.partnerId),
      amount: transaction.amount,
      gateway: transaction.gateway,
      code: transaction.code,
      content: transaction.content,
      status: transaction.status,
    });

    booking.payment_transactionId = transaction._id;
    await booking.save();

    const paymentInfo = await getPartnerPaymentInfo(trip.partnerId);

    console.log("[BOOKING][QR INPUT BEFORE generateSepayQrUrl]", {
      // QUAN TRỌNG: bankName ở đây phải là mã bank VPB, không phải VPBank
      bankName: paymentInfo.bankCode,
      bankNumber: paymentInfo.accountNumber,
      amount: total,
      content: paymentContent,
      bankAccountName: paymentInfo.accountName,

      displayBankNameForFE: paymentInfo.bankName,
    });

    const qrUrl = generateSepayQrUrl({
      bankName: paymentInfo.bankCode,
      bankNumber: paymentInfo.accountNumber,
      amount: total,
      content: paymentContent,
      bankAccountName: paymentInfo.accountName,
    });

    console.log("[BOOKING][QR GENERATED]", {
      qrUrl,
      expectedBankCode: paymentInfo.bankCode,
      expectedAccountNumber: paymentInfo.accountNumber,
      expectedAccountName: paymentInfo.accountName,
    });

    console.log("================ [BOOKING][CREATE DONE] ================\n");

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

        // Hiển thị FE
        bankName: paymentInfo.bankName,

        // Dùng thật để QR
        bankCode: paymentInfo.bankCode,
        bankNumber: paymentInfo.accountNumber,
        accountNumber: paymentInfo.accountNumber,
        bankAccountName: paymentInfo.accountName,
        accountName: paymentInfo.accountName,

        qrUrl,
        expiresAt,
      },
      serverTime: now,
    };
  } catch (error) {
    console.error("[BOOKING][CREATE ERROR]", {
      message: error.message,
      stack: error.stack,
      tripId: trip?._id ? String(trip._id) : null,
      holdToken,
      seatCount,
      bookingId: booking?._id ? String(booking._id) : null,
      transactionId: transaction?._id ? String(transaction._id) : null,
    });

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
    customerId,
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
        path: "tripId",
        select:
          "tripCode departureDate actualDepartureTime actualArrivalTime status routeId",
        populate: {
          path: "routeId",
          select: "routeName originProvince destinationProvince",
        }
      })
      .populate({
        path: "partnerId",
        select: "fullName email phone profilePicture",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Booking.countDocuments(filter),
  ]);

  return {
    bookings,
    pagination: {
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
      limit,
    },
  };
};

const getBookingByCodeForCustomer = async (customerId, bookingCode) => {
  const booking = await Booking.findOne({
    bookingCode: String(bookingCode || "")
      .trim()
      .toUpperCase(),
    customerId,
  })
    .populate({
      path: "tripId",
      select:
        "tripCode departureDate actualDepartureTime actualArrivalTime status routeId scheduleId busId partnerId",
      populate: [
        {
          path: "routeId",
          select:
            "routeName originProvince originDistrict destinationProvince destinationDistrict distanceKm estimatedDuration",
        },
        {
          path: "scheduleId",
          select: "scheduleCode departureTime arrivalTime recurrenceType",
        },
        {
          path: "busId",
          select: "busName busType totalSeats licensePlate images",
        },
      ],
    })
    .populate({
      path: "partnerId",
      select: "fullName email phone profilePicture",
    });

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  return booking;
};

const getBookingDetail = async (customerId, bookingCode) => {
  const booking = await getBookingByCodeForCustomer(customerId, bookingCode);

  const [seats, transaction] = await Promise.all([
    BookingSeat.find({ bookingId: booking._id }).lean(),
    Transaction.findOne({ bookingId: booking._id }).lean(),
  ]);

  return {
    booking,
    seats,
    transaction,
  };
};

const getBookingStatus = async (customerId, bookingCode) => {
  const booking = await Booking.findOne({
    bookingCode: String(bookingCode || "")
      .trim()
      .toUpperCase(),
    customerId,
  })
    .select(
      "bookingCode status payment_status total payment_amount expiresAt confirmedAt cancelRequestedAt cancelledAt createdAt updatedAt",
    )
    .lean();

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  return {
    bookingCode: booking.bookingCode,
    status: booking.status,
    payment_status: booking.payment_status,
    total: booking.total,
    payment_amount: booking.payment_amount,
    expiresAt: booking.expiresAt,
    confirmedAt: booking.confirmedAt,
    cancelRequestedAt: booking.cancelRequestedAt,
    cancelledAt: booking.cancelledAt,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    serverTime: new Date(),
  };
};

const getBookingPayment = async (customerId, bookingCode) => {
  const booking = await Booking.findOne({
    bookingCode: String(bookingCode || "")
      .trim()
      .toUpperCase(),
    customerId,
  });

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  const transaction = await Transaction.findOne({ bookingId: booking._id });

  if (!transaction) {
    throw new AppError("Transaction not found", 404);
  }

  const paymentInfo = await getPartnerPaymentInfo(booking.partnerId);

  const qrUrl = generateSepayQrUrl({
    bankName: paymentInfo.bankName,
    bankNumber: paymentInfo.bankNumber,
    amount: transaction.amount,
    content: transaction.content,
    bankAccountName: paymentInfo.bankAccountName,
  });

  return {
    booking: {
      bookingCode: booking.bookingCode,
      status: booking.status,
      payment_status: booking.payment_status,
      total: booking.total,
      expiresAt: booking.expiresAt,
    },
    payment: {
      transactionId: transaction._id,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      gateway: transaction.gateway,
      content: transaction.content,
      bankName: paymentInfo.bankName,
      bankCode: paymentInfo.bankCode,
      bankNumber: paymentInfo.bankNumber,
      accountNumber: paymentInfo.accountNumber,
      bankAccountName: paymentInfo.bankAccountName,
      accountName: paymentInfo.accountName,
      qrUrl,
      expiresAt: transaction.expiresAt,
    },
    serverTime: new Date(),
  };
};

const getBookingTickets = async (customerId, bookingCode) => {
  const normalizedCode = String(bookingCode || "").trim().toUpperCase();

  const booking = await Booking.findOne({
    bookingCode: normalizedCode,
    customerId,
  }).lean();

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  const tickets = await Ticket.find({ bookingId: booking._id }).lean();

  return {
    bookingCode: booking.bookingCode,
    tickets,
  };
};

const getBookingTicketsPdf = async (customerId, bookingCode) =>
  buildBookingTicketsPdf(customerId, bookingCode);

const releaseHeldSeatsForBooking = async (booking) => {
  const bookingSeats = await BookingSeat.find({
    bookingId: booking._id,
  }).lean();
  const seatCodes = bookingSeats.map((seat) => seat.seatCode);

  if (seatCodes.length === 0) {
    return {
      releasedSeatCodes: [],
      releasedCount: 0,
    };
  }

  const result = await Trip.updateOne(
    {
      _id: booking.tripId,
    },
    {
      $set: {
        "seats.$[seat].status": "AVAILABLE",
        "seats.$[seat].bookingId": null,
        "seats.$[seat].holdToken": null,
        "seats.$[seat].lockedUntil": null,
      },
      $inc: {
        availableSeats: seatCodes.length,
        heldSeats: -seatCodes.length,
      },
    },
    {
      arrayFilters: [
        {
          "seat.seatCode": { $in: seatCodes },
          "seat.bookingId": booking._id,
          "seat.status": "HELD",
        },
      ],
    },
  );

  return {
    releasedSeatCodes: seatCodes,
    releasedCount: result.modifiedCount === 1 ? seatCodes.length : 0,
  };
};

const createTicketsForPaidBooking = async (booking) => {
  const existingTickets = await Ticket.find({ bookingId: booking._id }).lean();

  if (existingTickets.length > 0) {
    return {
      createdCount: 0,
      skipped: true,
    };
  }

  const bookingSeats = await BookingSeat.find({ bookingId: booking._id }).lean();

  if (bookingSeats.length === 0) {
    throw new AppError("Booking seats not found", 404);
  }

  const buildTicketCode = (seatCode) =>
    `${String(booking.bookingCode || "").trim().toUpperCase()}-${String(seatCode || "").trim().toUpperCase()}`;

  const tickets = bookingSeats.map((seat) => ({
    bookingId: booking._id,
    tripId: booking.tripId,
    seatCode: seat.seatCode,
    ticketCode: buildTicketCode(seat.seatCode),
  }));

  const createdTickets = await Ticket.insertMany(tickets);

  return {
    createdCount: createdTickets.length,
    skipped: false,
  };
};

const processSepayBookingPayment = async (payload = {}, authenticatedPartner = null) => {
  const bookingCode = extractBookingCodeFromSepayPayload(payload);

  if (!bookingCode) {
    return {
      handled: false,
    };
  }

  if (payload.transferType && String(payload.transferType).toLowerCase() !== "in") {
    return {
      handled: true,
      message: "Acknowledged: Not an incoming payment",
      data: {
        bookingCode,
      },
    };
  }

  const transferAmount = Number(payload.transferAmount || 0);

  if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
    throw new AppError("Invalid transfer amount", 400);
  }

  const booking = await Booking.findOne({ bookingCode });

  if (!booking) {
    return {
      handled: true,
      message: "Acknowledged: Booking not found",
      data: {
        bookingCode,
      },
    };
  }

  const authenticatedPartnerId = authenticatedPartner
    ? String(
        authenticatedPartner.accountId ||
          authenticatedPartner.partnerId ||
          authenticatedPartner._id ||
          "",
      )
    : "";

  if (authenticatedPartnerId && String(booking.partnerId) !== authenticatedPartnerId) {
    return {
      handled: true,
      message: "Acknowledged: Webhook partner does not match booking partner",
      data: {
        bookingCode,
      },
    };
  }

  const transaction = await Transaction.findOne({
    bookingId: booking._id,
    transactionType: "BOOKING_PAYMENT",
  });

  if (!transaction) {
    return {
      handled: true,
      message: "Acknowledged: Booking payment transaction not found",
      data: {
        bookingCode,
      },
    };
  }

  if (transaction.status === "SUCCESS" || booking.payment_status === "PAID") {
    return {
      handled: true,
      message: "Booking payment already processed",
      data: {
        bookingCode: booking.bookingCode,
        transactionId: transaction._id,
      },
    };
  }

  if (booking.status !== "PENDING_PAYMENT" || booking.payment_status !== "PENDING") {
    return {
      handled: true,
      message: "Acknowledged: Booking is not pending payment",
      data: {
        bookingCode: booking.bookingCode,
        transactionId: transaction._id,
      },
    };
  }

  if (booking.expiresAt && booking.expiresAt <= new Date()) {
    return {
      handled: true,
      message: "Acknowledged: Booking payment has expired",
      data: {
        bookingCode: booking.bookingCode,
        transactionId: transaction._id,
      },
    };
  }

  if (transferAmount < Number(transaction.amount)) {
    await Transaction.updateOne(
      { _id: transaction._id },
      {
        $set: {
          status: "FAILED",
          transferAmount,
          sepayTransactionId: payload.id || transaction.sepayTransactionId,
          gateway: payload.gateway || transaction.gateway,
          transactionDate: payload.transactionDate
            ? new Date(payload.transactionDate)
            : transaction.transactionDate,
          accountNumber: payload.accountNumber || transaction.accountNumber,
          subAccount: payload.subAccount || transaction.subAccount,
          transferType: payload.transferType || transaction.transferType,
          referenceCode: payload.referenceCode || transaction.referenceCode,
          description: payload.description || transaction.description,
        },
      },
    );

    return {
      handled: true,
      message: "Acknowledged: Insufficient payment amount",
      data: {
        bookingCode: booking.bookingCode,
        transactionId: transaction._id,
        transferAmount,
      },
    };
  }

  const bookingSeats = await BookingSeat.find({ bookingId: booking._id }).lean();
  const seatCodes = bookingSeats.map((seat) => seat.seatCode);

  if (seatCodes.length === 0) {
    throw new AppError("Booking seats not found", 404);
  }

  await Transaction.updateOne(
    { _id: transaction._id },
    {
      $set: {
        status: "SUCCESS",
        transferAmount,
        sepayTransactionId: payload.id || transaction.sepayTransactionId,
        gateway: payload.gateway || transaction.gateway,
        transactionDate: payload.transactionDate
          ? new Date(payload.transactionDate)
          : transaction.transactionDate,
        accountNumber: payload.accountNumber || transaction.accountNumber,
        subAccount: payload.subAccount || transaction.subAccount,
        transferType: payload.transferType || transaction.transferType,
        referenceCode: payload.referenceCode || transaction.referenceCode,
        description: payload.description || transaction.description,
      },
    },
  );

  const bookingUpdate = {
    status: "CONFIRMED",
    payment_status: "PAID",
  };

  if (Booking.schema?.paths?.confirmedAt) {
    bookingUpdate.confirmedAt = new Date();
  }

  if (Booking.schema?.paths?.paidAt) {
    bookingUpdate.paidAt = new Date();
  }

  await Booking.updateOne(
    { _id: booking._id },
    {
      $set: bookingUpdate,
    },
  );

  await Trip.updateOne(
    {
      _id: booking.tripId,
    },
    {
      $set: {
        "seats.$[seat].status": "BOOKED",
        "seats.$[seat].bookingId": booking._id,
        "seats.$[seat].holdToken": null,
        "seats.$[seat].lockedUntil": null,
      },
      $inc: {
        heldSeats: -seatCodes.length,
        bookedSeats: seatCodes.length,
      },
    },
    {
      arrayFilters: [
        {
          "seat.seatCode": { $in: seatCodes },
          "seat.bookingId": booking._id,
          "seat.status": "HELD",
        },
      ],
    },
  );

  const ticketResult = await createTicketsForPaidBooking(booking);

  const [customerAccount, tripForEmail] = await Promise.all([
    Account.findById(booking.customerId).select("email fullName").lean(),
    Trip.findById(booking.tripId)
      .select("tripCode departureDate actualDepartureTime actualArrivalTime")
      .lean(),
  ]);

  const recipientEmail = booking.passengerEmail || customerAccount?.email || null;

  if (recipientEmail) {
    const departureTime = formatMinutesToClock(tripForEmail?.actualDepartureTime);
    const passengerName =
      booking.passengerName || customerAccount?.fullName || "Customer";

    emailService
      .sendBookingConfirmationEmail({
        email: recipientEmail,
        customerName: passengerName,
        bookingCode: booking.bookingCode,
        tripCode: tripForEmail?.tripCode || String(booking.tripId),
        departureDate: tripForEmail?.departureDate || booking.createdAt,
        departureTime,
        seatCodes,
        total: booking.total,
        passengerPhone: booking.passengerPhone,
        pickupPoint: [booking.pickupPoint_name, booking.pickupPoint_address]
          .filter(Boolean)
          .join(" - "),
        dropoffPoint: [booking.dropoffPoint_name, booking.dropoffPoint_address]
          .filter(Boolean)
          .join(" - "),
      })
      .catch((err) =>
        console.error("[Booking Webhook] Failed to send booking confirmation email:", err),
      );
  }

  return {
    handled: true,
    message: "Booking payment processed successfully",
    data: {
      bookingCode: booking.bookingCode,
      transactionId: transaction._id,
      transferAmount,
      seatCodes,
      ticketResult,
    },
  };
};

const expireStaleBookings = async () => {
  const now = new Date();

  const staleBookings = await Booking.find({
    status: "PENDING_PAYMENT",
    payment_status: "PENDING",
    expiresAt: { $lte: now },
  }).limit(100);

  const results = [];

  for (const booking of staleBookings) {
    const releaseResult = await releaseHeldSeatsForBooking(booking);

    await Transaction.updateMany(
      {
        bookingId: booking._id,
        status: "PENDING",
      },
      {
        $set: {
          status: "EXPIRED",
        },
      },
    );

    booking.status = "CANCELLED_BY_CUSTOMER";
    booking.payment_status = "EXPIRED";
    booking.cancelReason = "Payment expired";
    booking.cancelledAt = new Date();
    await booking.save();

    results.push({
      bookingCode: booking.bookingCode,
      releasedSeatCodes: releaseResult.releasedSeatCodes,
      releasedCount: releaseResult.releasedCount,
    });
  }

  return {
    expiredCount: results.length,
    results,
  };
};

const completeArrivedBookings = async () => {
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const trips = await Trip.find({
    status: { $in: ["OPEN", "CLOSED", "DELAYED"] },
    departureDate: { $lte: todayEnd },
    actualArrivalTime: { $ne: null },
  })
    .select("_id tripCode departureDate actualDepartureTime actualArrivalTime status")
    .limit(200)
    .lean();

  const results = [];

  for (const trip of trips) {
    const arrivalDateTime = getTripArrivalDateTime(trip);

    if (!arrivalDateTime || arrivalDateTime > now) {
      continue;
    }

    const [tripUpdateResult, bookingUpdateResult] = await Promise.all([
      Trip.updateOne(
        {
          _id: trip._id,
          status: { $in: ["OPEN", "CLOSED", "DELAYED"] },
        },
        {
          $set: {
            status: "COMPLETED",
          },
        },
      ),
      Booking.updateMany(
        {
          tripId: trip._id,
          status: "CONFIRMED",
          payment_status: "PAID",
        },
        {
          $set: {
            status: "COMPLETED",
          },
        },
      ),
    ]);

    if (tripUpdateResult.modifiedCount > 0 || bookingUpdateResult.modifiedCount > 0) {
      results.push({
        tripId: trip._id,
        tripCode: trip.tripCode,
        arrivalDateTime,
        completedBookings: bookingUpdateResult.modifiedCount,
      });
    }
  }

  return {
    completedTripCount: results.length,
    completedBookingCount: results.reduce(
      (sum, item) => sum + item.completedBookings,
      0,
    ),
    results,
  };
};

const cancelBooking = async (customerId, bookingCode, reason = "") => {
  const booking = await Booking.findOne({
    bookingCode: String(bookingCode || "")
      .trim()
      .toUpperCase(),
    customerId,
  });

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  if (
    ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_OPERATOR", "REFUNDED"].includes(
      booking.status,
    )
  ) {
    throw new AppError("Booking has already been cancelled", 400);
  }

  if (booking.status === "CANCEL_REQUESTED") {
    throw new AppError("Cancellation request has already been submitted", 400);
  }

  if (
    booking.status === "PENDING_PAYMENT" &&
    booking.payment_status === "PENDING"
  ) {
    const releaseResult = await releaseHeldSeatsForBooking(booking);

    booking.status = "CANCELLED_BY_CUSTOMER";
    booking.payment_status = "CANCELLED";
    booking.cancelReason = reason;
    booking.cancelledAt = new Date();

    await booking.save();

    await Transaction.updateMany(
      {
        bookingId: booking._id,
        status: "PENDING",
      },
      {
        $set: {
          status: "CANCELLED",
        },
      },
    );

    return {
      bookingCode: booking.bookingCode,
      status: booking.status,
      payment_status: booking.payment_status,
      releasedSeatCodes: releaseResult.releasedSeatCodes,
      releasedCount: releaseResult.releasedCount,
    };
  }

  throw new AppError("Only pending unpaid bookings can be cancelled directly", 400);
};

const requestCancelBooking = async (customerId, bookingCode, reason = "") => {
  const booking = await Booking.findOne({
    bookingCode: String(bookingCode || "")
      .trim()
      .toUpperCase(),
    customerId,
  });

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  if (
    ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_OPERATOR", "REFUNDED"].includes(
      booking.status,
    )
  ) {
    throw new AppError("Booking has already been cancelled", 400);
  }

  if (booking.status === "CANCEL_REQUESTED") {
    throw new AppError("Cancellation request has already been submitted", 400);
  }

  if (booking.status === "COMPLETED") {
    throw new AppError("Completed booking cannot be cancelled", 400);
  }

  if (booking.status === "CONFIRMED" && booking.payment_status === "PAID") {
    const trip = await Trip.findById(booking.tripId).select(
      "departureDate actualDepartureTime status",
    );

    if (!trip) {
      throw new AppError("Trip not found for this booking", 404);
    }

    if (["CANCELLED", "COMPLETED"].includes(trip.status)) {
      throw new AppError("Booking cannot be cancelled because the trip is no longer active", 400);
    }

    const departureAt = getTripDateTime(
      trip.departureDate,
      trip.actualDepartureTime,
    );
    const timeUntilDeparture = departureAt.getTime() - Date.now();

    if (timeUntilDeparture <= 0) {
      throw new AppError("Booking cannot be cancelled after departure time", 400);
    }

    if (timeUntilDeparture < CUSTOMER_CANCEL_CUTOFF_MS) {
      throw new AppError(
        `Booking can only be cancelled at least ${CUSTOMER_CANCEL_CUTOFF_HOURS} hours before departure`,
        400,
      );
    }

    booking.status = "CANCEL_REQUESTED";
    booking.cancelReason = reason;
    booking.cancelRequestedAt = new Date();

    await booking.save();

    return {
      bookingCode: booking.bookingCode,
      status: booking.status,
      payment_status: booking.payment_status,
      message:
        "Cancellation request submitted. Refund will be handled manually.",
    };
  }

  throw new AppError("Only confirmed paid bookings can request cancellation", 400);
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingDetail,
  getBookingStatus,
  getBookingPayment,
  getBookingTickets,
  getBookingTicketsPdf,
  releaseHeldSeatsForBooking,
  expireStaleBookings,
  completeArrivedBookings,
  cancelBooking,
  requestCancelBooking,
  cleanupFailedBooking,
  processSepayBookingPayment,
  createTicketsForPaidBooking,
};
