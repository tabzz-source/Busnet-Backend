const express = require('express');
const favouriteController = require('../../controllers/customer/customerFavourite.controller');
const authenticate = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
    validatePartnerId
} = require('../../validations/favourite.validation');

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

router.get(
    '/operators',
    favouriteController.getFavouriteOperators
);

router.get(
    '/operators/:partnerId/status',
    validatePartnerId,
    validate,
    favouriteController.getFavouriteOperatorStatus
);

router.post(
    '/operators/:partnerId',
    validatePartnerId,
    validate,
    favouriteController.addFavouriteOperator
);

router.delete(
    '/operators/:partnerId',
    validatePartnerId,
    validate,
    favouriteController.removeFavouriteOperator
);

module.exports = router;