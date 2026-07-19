const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const searchHistoryService = require('../../services/searchHistory.service');

const saveSearchHistory = asyncHandler(async (req, res) => {
    const customerId = req.user.id || req.user._id;
    const { departureLocation, arrivalLocation, departureDate } = req.body;

    const historyItem = await searchHistoryService.saveSearchHistory(customerId, {
        departureLocation,
        arrivalLocation,
        departureDate
    });

    return successResponse(
        res,
        201,
        'Search history saved successfully',
        historyItem
    );
});

const getSearchHistories = asyncHandler(async (req, res) => {
    const customerId = req.user.id || req.user._id;
    const limit = req.query.limit || 3;

    const histories = await searchHistoryService.getSearchHistories(customerId, limit);

    return successResponse(
        res,
        200,
        'Search history retrieved successfully',
        histories
    );
});

const deleteSearchHistory = asyncHandler(async (req, res) => {
    const customerId = req.user.id || req.user._id;
    const { id } = req.params;

    await searchHistoryService.deleteSearchHistory(customerId, id);

    return successResponse(
        res,
        200,
        'Search history item deleted successfully'
    );
});

const clearSearchHistories = asyncHandler(async (req, res) => {
    const customerId = req.user.id || req.user._id;

    const result = await searchHistoryService.clearSearchHistories(customerId);

    return successResponse(
        res,
        200,
        'All search history cleared successfully',
        result
    );
});

module.exports = {
    saveSearchHistory,
    getSearchHistories,
    deleteSearchHistory,
    clearSearchHistories
};
