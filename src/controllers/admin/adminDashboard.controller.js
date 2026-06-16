const dashboardService = require('../../services/dashboard.service');

const getStats = async (req, res) => {
    try {
        const result = await dashboardService.getAdminDashboardStats();

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

module.exports = {
    getStats
};
