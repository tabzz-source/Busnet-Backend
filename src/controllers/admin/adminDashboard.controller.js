const dashboardService = require('../../services/dashboard.service');
const { buildStatisticsXlsxBuffer, buildStatisticsPdfBuffer } = require('../../utils/statisticsExport');

const getStats = async (req, res) => {
    try {
        const unit = req.query.unit === 'month' ? 'month' : 'day';
        const amount = parseInt(req.query.amount) || (unit === 'month' ? 6 : 30);
        const result = await dashboardService.getAdminDashboardStats(unit, amount);

        return res.status(200).json({
            success: true,
            message: 'Dashboard stats fetched successfully',
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const getRevenueChart = async (req, res) => {
    try {
        const unit = req.query.unit === 'month' ? 'month' : 'day';
        const amount = parseInt(req.query.amount) || undefined;
        const result = await dashboardService.getRevenueChart(unit, amount);

        return res.status(200).json({
            success: true,
            message: 'Revenue chart data fetched successfully',
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const getRevenueBreakdown = async (req, res) => {
    try {
        const unit = req.query.unit === 'month' ? 'month' : 'day';
        const amount = parseInt(req.query.amount) || (unit === 'month' ? 6 : 30);
        const result = await dashboardService.getRevenueBreakdown(unit, amount);

        return res.status(200).json({
            success: true,
            message: 'Revenue breakdown fetched successfully',
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const exportStatistics = async (req, res) => {
    try {
        const format = (req.query.format || 'xlsx').toLowerCase();
        if (format !== 'xlsx' && format !== 'pdf') {
            return res.status(400).json({
                success: false,
                message: 'Invalid format. Use "xlsx" or "pdf".'
            });
        }

        const unit = req.query.unit === 'month' ? 'month' : 'day';
        const amount = parseInt(req.query.amount) || undefined;
        const generatedBy = req.user?.fullName || req.user?.username || 'BusNet Admin';
        const exportData = await dashboardService.getExportData(unit, amount, generatedBy);

        const datestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `busnet-statistics-${unit}${exportData.period.amount}-${datestamp}.${format}`;

        // Content-Disposition isn't in the CORS-safelisted response headers,
        // so the browser can't read it (to recover the filename) unless it's explicitly exposed.
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

        if (format === 'xlsx') {
            const xlsxBuffer = await buildStatisticsXlsxBuffer(exportData);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', xlsxBuffer.length);
            return res.send(xlsxBuffer);
        }

        const pdfBuffer = await buildStatisticsPdfBuffer(exportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        return res.send(pdfBuffer);
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getStats,
    getRevenueChart,
    getRevenueBreakdown,
    exportStatistics
};
