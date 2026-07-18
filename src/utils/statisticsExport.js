const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Every value here is scoped to the selected period (new in period), not an
// all-time running total — labels reflect that so the export isn't misleading.
const STAT_LABELS = {
    revenue: 'Platform Revenue',
    users: 'New Customers',
    partners: 'New Partners',
    activeRoutes: 'New Routes',
    reports: 'New Reports'
};

const TX_TYPE_LABELS = {
    BOOKING_PAYMENT: 'Booking Payment',
    SUBSCRIPTION_PAYMENT: 'Subscription',
    REFUND: 'Refund',
    OTHER: 'Other'
};

// Only "revenue" is money — the other Summary stats (New Customers/Partners/
// Routes/Reports) are plain counts and must never be formatted with a
// currency unit, unlike every Revenue Breakdown / Revenue Chart row (always money).
const CURRENCY_STAT_KEYS = new Set(['revenue']);

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
const CATEGORY_COLOR = 'FF8B0000';
const THIN_BORDER = { style: 'thin', color: { argb: 'FF000000' } };
const BOX_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

const formatPeriodLabel = (period) => {
    const unitLabel = period.unit === 'month' ? 'month(s)' : 'day(s)';
    return `Last ${period.amount} ${unitLabel}`;
};

// Chart date keys are plain calendar strings ('2026-07-10' or '2026-07'), not
// moments in time — reformat them by splitting the string, not via Date/timezone
// math, so there's no risk of shifting to the next/previous day.
const formatIsoDateToVN = (iso) => {
    const parts = String(iso).split('-');
    if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d}/${m}/${y}`;
    }
    if (parts.length === 2) {
        const [y, m] = parts;
        return `${m}/${y}`;
    }
    return String(iso);
};

// generatedAt IS a real moment in time (captured when the export request was
// handled), so it's formatted with an explicit timezone for a deterministic,
// human-readable "exact download time" regardless of the server's own timezone.
const formatDateTimeVN = (date) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: VN_TIMEZONE
    }).formatToParts(date).reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
    }, {});

    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
};

// Builds a real Date (UTC midnight) from the chart's calendar-key string, so
// it can be written as a native Excel date cell — Excel then right-aligns and
// formats it automatically instead of treating it as plain left-aligned text.
const parseIsoDateForExcel = (iso) => {
    const parts = String(iso).split('-').map(Number);
    if (parts.length === 3) {
        const [y, m, d] = parts;
        return { date: new Date(Date.UTC(y, m - 1, d)), numFmt: 'dd/mm/yyyy' };
    }
    if (parts.length === 2) {
        const [y, m] = parts;
        return { date: new Date(Date.UTC(y, m - 1, 1)), numFmt: 'mm/yyyy' };
    }
    return null;
};

// One continuous table (merged title row, a right-aligned meta row, a single
// bold header row, then bordered, numbered detail rows) — the normal
// spreadsheet shape, instead of several small tables stacked in one sheet.
const buildStatisticsXlsxBuffer = async (exportData) => {
    const { generatedAt, period, stats, revenueBreakdown, revenueChart } = exportData;

    const workbook = new ExcelJS.Workbook();
    workbook.created = generatedAt;
    const sheet = workbook.addWorksheet('Statistics');

    sheet.columns = [
        { width: 6 },
        { width: 20 },
        { width: 24 },
        { width: 14 },
        { width: 20 }
    ];

    sheet.mergeCells('A1:E1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'BusNet System Statistics Export';
    titleCell.font = { size: 14, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:E2');
    const metaCell = sheet.getCell('A2');
    metaCell.value = `Generated At: ${formatDateTimeVN(generatedAt)}    Period: ${formatPeriodLabel(period)}`;
    metaCell.alignment = { horizontal: 'right' };

    const headerRowIndex = 4;
    const headerRow = sheet.getRow(headerRowIndex);
    headerRow.values = ['No.', 'Category', 'Detail', 'Transactions', 'Value'];
    headerRow.font = { bold: true };
    headerRow.getCell(4).alignment = { horizontal: 'center' };
    for (let col = 1; col <= 5; col++) {
        headerRow.getCell(col).border = BOX_BORDER;
    }

    let rowIndex = headerRowIndex + 1;
    let no = 1;

    const addRow = (category, detail, transactions, value, isCurrency = true, signed = false) => {
        const row = sheet.getRow(rowIndex++);
        row.getCell(1).value = no++;
        row.getCell(2).value = category;
        row.getCell(2).font = { color: { argb: CATEGORY_COLOR } };

        if (detail.isDate) {
            row.getCell(3).value = detail.date;
            row.getCell(3).numFmt = detail.numFmt;
            row.getCell(3).alignment = { horizontal: 'right' };
        } else {
            row.getCell(3).value = detail.text;
        }

        if (transactions !== '') {
            row.getCell(4).value = transactions;
            row.getCell(4).alignment = { horizontal: 'center' };
        }

        row.getCell(5).value = value;
        if (isCurrency) {
            row.getCell(5).numFmt = signed ? '+#,##0 "VND";-#,##0 "VND"' : '#,##0 "VND"';
        } else {
            row.getCell(5).numFmt = '#,##0';
        }
        row.getCell(5).font = { color: { argb: CATEGORY_COLOR } };

        for (let col = 1; col <= 5; col++) {
            row.getCell(col).border = BOX_BORDER;
        }
    };

    Object.entries(STAT_LABELS).forEach(([key, label]) => {
        addRow('Summary', { isDate: false, text: label }, '', stats[key].value, CURRENCY_STAT_KEYS.has(key));
    });

    revenueBreakdown.forEach((row) => {
        // REFUND rows are stored as a positive magnitude in the DB (same as the
        // dashboard's raw breakdown data) — negate for display so the sign
        // matches the web UI's red "−" convention instead of reading as added revenue.
        const signedTotal = row.type === 'REFUND' ? -row.total : row.total;
        addRow('Revenue Breakdown', { isDate: false, text: TX_TYPE_LABELS[row.type] || row.type }, row.count, signedTotal, true, true);
    });

    revenueChart.forEach((point) => {
        const parsed = parseIsoDateForExcel(point.date);
        addRow('Revenue Chart', parsed ? { isDate: true, ...parsed } : { isDate: false, text: point.date }, '', point.revenue);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
};

// Plain-ASCII "VND" everywhere (web + exports) — matches the currency code
// convention and sidesteps pdfkit's built-in Helvetica (WinAnsi-encoded)
// having no glyph for "Đ", which used to silently render "VNĐ" as "VN".
const formatCurrencyPdf = (value) => `${Number(value).toLocaleString('en-US')} VND`;

// Count-only Summary stats (New Customers/Partners/Routes/Reports) must not
// carry a currency unit — only formatCurrencyPdf's actual money values should.
const formatValuePdf = (value, isCurrency) => (isCurrency ? formatCurrencyPdf(value) : Number(value).toLocaleString('en-US'));

// Matches the web UI's "+X" / red "−X" convention for Revenue Breakdown rows.
const formatSignedCurrencyPdf = (value) => `${value < 0 ? '-' : '+'}${Math.abs(Number(value)).toLocaleString('en-US')} VND`;

// Page geometry for the bordered "business report" template: a black frame
// inset from the page edge, with content living inside the doc's own margins.
const PAGE_BORDER_INSET = 20;
const CONTENT_LEFT = 40;
const CONTENT_RIGHT = 555; // A4 width (595.28) minus the 40pt right margin
const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;

const ITEMS_COLS = [
    { key: 'no', label: 'No.', x: 40, width: 25, align: 'left' },
    { key: 'category', label: 'Category', x: 65, width: 95, align: 'left' },
    { key: 'detail', label: 'Detail', x: 160, width: 195, align: 'left' },
    { key: 'transactions', label: 'Transactions', x: 355, width: 80, align: 'center' },
    { key: 'amount', label: 'Amount', x: 435, width: 120, align: 'right' }
];

const drawPageBorder = (doc) => {
    doc.save();
    doc.lineWidth(2).strokeColor('#000000')
        .rect(PAGE_BORDER_INSET, PAGE_BORDER_INSET, doc.page.width - PAGE_BORDER_INSET * 2, doc.page.height - PAGE_BORDER_INSET * 2)
        .stroke();
    doc.restore();
};

// Two-column "label / value" block styled like a form header (black label
// cells, alternating white/gray value cells) — mirrors the requested
// business-report template's "Submitted By / Submitted On / ..." block.
const drawInfoBlock = (doc, rows, y) => {
    const rowHeight = 20;
    const labelWidth = 150;

    rows.forEach(([label, value], i) => {
        const rowY = y + i * rowHeight;
        doc.rect(CONTENT_LEFT, rowY, labelWidth, rowHeight).fill('#000000');
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
            .text(label, CONTENT_LEFT + 8, rowY + 5, { width: labelWidth - 16 });

        const valueBg = i % 2 === 0 ? '#ffffff' : '#d9d9d9';
        doc.rect(CONTENT_LEFT + labelWidth, rowY, CONTENT_WIDTH - labelWidth, rowHeight).fill(valueBg);
        doc.font('Helvetica').fontSize(10).fillColor('#000000')
            .text(value, CONTENT_LEFT + labelWidth + 8, rowY + 5, { width: CONTENT_WIDTH - labelWidth - 16 });
    });

    doc.moveTo(CONTENT_LEFT, y).lineTo(CONTENT_RIGHT, y).lineWidth(2).strokeColor('#000000').stroke();
    return y + rows.length * rowHeight;
};

const drawItemsHeader = (doc, y) => {
    const rowHeight = 20;
    doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, rowHeight).fill('#000000');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
    ITEMS_COLS.forEach((col) => {
        doc.text(col.label, col.x + 4, y + 6, { width: col.width - 8, align: col.align });
    });
    return y + rowHeight;
};

const drawItemsRow = (doc, y, values) => {
    const rowHeight = 18;
    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    ITEMS_COLS.forEach((col) => {
        const v = values[col.key];
        doc.text(v === undefined || v === null ? '' : String(v), col.x + 4, y + 4, { width: col.width - 8, align: col.align });
    });
    doc.moveTo(CONTENT_LEFT, y + rowHeight).lineTo(CONTENT_RIGHT, y + rowHeight).lineWidth(0.5).strokeColor('#999999').stroke();
    return y + rowHeight;
};

const drawTotalRow = (doc, y, totalLabel, totalValue) => {
    const rowHeight = 22;
    doc.moveTo(CONTENT_LEFT, y).lineTo(CONTENT_RIGHT, y).lineWidth(1.5).strokeColor('#000000').stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
    doc.text(totalLabel, CONTENT_LEFT + 4, y + 5, { width: 250 });
    const amountCol = ITEMS_COLS[ITEMS_COLS.length - 1];
    doc.text(totalValue, amountCol.x + 4, y + 5, { width: amountCol.width - 8, align: 'right' });
    return y + rowHeight;
};

const buildStatisticsPdfDoc = (exportData) => {
    const { generatedAt, generatedBy, period, stats, revenueBreakdown, revenueChart } = exportData;
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const pageBottomLimit = doc.page.height - 60;

    doc.on('pageAdded', () => drawPageBorder(doc));
    drawPageBorder(doc);

    // Letterhead
    doc.font('Helvetica-BoldOblique').fontSize(24).fillColor('#000000')
        .text('BusNet', CONTENT_LEFT, 50, { width: CONTENT_WIDTH, align: 'center' });
    doc.font('Helvetica').fontSize(10).fillColor('#444444')
        .text('Admin Console • Bus Ticket Booking Platform', CONTENT_LEFT, 82, { width: CONTENT_WIDTH, align: 'center' });
    doc.font('Helvetica-BoldOblique').fontSize(18).fillColor('#000000')
        .text('System Statistics Report', CONTENT_LEFT, 112, { width: CONTENT_WIDTH, align: 'center' });

    // Info block
    let y = drawInfoBlock(doc, [
        ['Generated By:', generatedBy],
        ['Generated At:', formatDateTimeVN(generatedAt)],
        ['Report Period:', formatPeriodLabel(period)],
        ['Currency:', 'VND']
    ], 155);

    y += 20;
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000')
        .text('Items', CONTENT_LEFT, y);
    y += 22;

    y = drawItemsHeader(doc, y);

    let no = 1;
    const rows = [
        ...Object.entries(STAT_LABELS).map(([key, label]) => ({
            category: 'Summary', detail: label, transactions: '', amount: formatValuePdf(stats[key].value, CURRENCY_STAT_KEYS.has(key))
        })),
        ...revenueBreakdown.map((row) => ({
            category: 'Revenue Breakdown', detail: TX_TYPE_LABELS[row.type] || row.type,
            transactions: row.count, amount: formatSignedCurrencyPdf(row.type === 'REFUND' ? -row.total : row.total)
        })),
        ...revenueChart.map((point) => ({
            category: 'Revenue Chart', detail: formatIsoDateToVN(point.date), transactions: '', amount: formatCurrencyPdf(point.revenue)
        }))
    ];

    rows.forEach((row) => {
        if (y + 18 > pageBottomLimit) {
            doc.addPage();
            y = 60;
            y = drawItemsHeader(doc, y);
        }
        y = drawItemsRow(doc, y, { no: no++, ...row });
    });

    if (rows.length === 0) {
        doc.font('Helvetica').fontSize(9).fillColor('#000000')
            .text('No data for the selected period', CONTENT_LEFT + 4, y + 4);
        y += 18;
    }

    if (y + 22 > pageBottomLimit) {
        doc.addPage();
        y = 60;
    }
    y = drawTotalRow(doc, y, 'Total Platform Revenue', formatCurrencyPdf(stats.revenue.value));

    y += 30;
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#888888')
        .text('This report was generated automatically by the BusNet Admin Console.', CONTENT_LEFT, y, { width: CONTENT_WIDTH, align: 'center' });

    return doc;
};

// Builds the PDF fully in memory before resolving, so the controller can send
// one complete response with a real Content-Length instead of streaming it
// (chunked transfer with no Content-Length risks a truncated/unreadable
// download if the connection is interrupted mid-stream).
const buildStatisticsPdfBuffer = (exportData) => {
    return new Promise((resolve, reject) => {
        const doc = buildStatisticsPdfDoc(exportData);
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.end();
    });
};

module.exports = {
    buildStatisticsXlsxBuffer,
    buildStatisticsPdfBuffer
};
