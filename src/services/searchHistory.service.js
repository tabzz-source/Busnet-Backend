const SearchHistory = require('../models/SearchHistory');
const AppError = require('../utils/AppError');

const saveSearchHistory = async (customerId, { departureLocation, arrivalLocation, departureDate }) => {
    const depLoc = departureLocation.trim();
    const arrLoc = arrivalLocation.trim();
    const parsedDate = new Date(departureDate);

    let historyItem = await SearchHistory.findOne({
        customerId,
        departureLocation: depLoc,
        arrivalLocation: arrLoc,
        departureDate: parsedDate
    });

    if (historyItem) {
        historyItem.searchedAt = new Date();
        await historyItem.save();
    } else {
        historyItem = await SearchHistory.create({
            customerId,
            departureLocation: depLoc,
            arrivalLocation: arrLoc,
            departureDate: parsedDate,
            searchedAt: new Date()
        });
    }

    // Keep at most 10 recent records per customer
    const totalCount = await SearchHistory.countDocuments({ customerId });
    if (totalCount > 10) {
        const oldestRecords = await SearchHistory.find({ customerId })
            .sort({ searchedAt: 1 })
            .limit(totalCount - 10)
            .select('_id');
        const idsToDelete = oldestRecords.map(doc => doc._id);
        await SearchHistory.deleteMany({ _id: { $in: idsToDelete } });
    }

    return historyItem;
};

const getSearchHistories = async (customerId, limit = 3) => {
    const numLimit = Math.min(Math.max(parseInt(limit, 10) || 3, 1), 10);

    const histories = await SearchHistory.find({ customerId })
        .sort({ searchedAt: -1 })
        .limit(numLimit)
        .lean();

    return histories;
};

const deleteSearchHistory = async (customerId, id) => {
    const deleted = await SearchHistory.findOneAndDelete({
        _id: id,
        customerId
    });

    if (!deleted) {
        throw new AppError('Search history item not found or unauthorized', 404);
    }

    return deleted;
};

const clearSearchHistories = async (customerId) => {
    const result = await SearchHistory.deleteMany({ customerId });
    return { deletedCount: result.deletedCount };
};

module.exports = {
    saveSearchHistory,
    getSearchHistories,
    deleteSearchHistory,
    clearSearchHistories
};
