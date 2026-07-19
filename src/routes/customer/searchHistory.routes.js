const express = require('express');
const searchHistoryController = require('../../controllers/customer/searchHistory.controller');
const authenticate = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
    validateSaveSearchHistory,
    validateSearchHistoryId
} = require('../../validations/searchHistory.validation');

const router = express.Router();

router.use(authenticate);

router.use((req, res, next) => {
    if (req.user.role !== 'CUSTOMER') {
        return res.status(403).json({
            success: false,
            message: 'Customer access only'
        });
    }
    next();
});

router.post(
    '/',
    validateSaveSearchHistory,
    validate,
    searchHistoryController.saveSearchHistory
);

router.get(
    '/',
    searchHistoryController.getSearchHistories
);

router.delete(
    '/:id',
    validateSearchHistoryId,
    validate,
    searchHistoryController.deleteSearchHistory
);

router.delete(
    '/',
    searchHistoryController.clearSearchHistories
);

module.exports = router;
