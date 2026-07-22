const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const favouriteService = require('../../services/favourite.service');

const getFavouriteOperators = asyncHandler(async (req, res) => {
    const customerId = req.user.id;

    const favourites = await favouriteService.getFavouriteOperators(customerId);

    return successResponse(
        res,
        200,
        'Favourite operators retrieved successfully',
        {
            favourites
        }
    );
});

const addFavouriteOperator = asyncHandler(async (req, res) => {
    const customerId = req.user.id;
    const { partnerId } = req.params;

    const favourite = await favouriteService.addFavouriteOperator(
        customerId,
        partnerId
    );

    return successResponse(
        res,
        201,
        'Operator added to favourites successfully',
        {
            favourite
        }
    );
});

const removeFavouriteOperator = asyncHandler(async (req, res) => {
    const customerId = req.user.id;
    const { partnerId } = req.params;

    await favouriteService.removeFavouriteOperator(customerId, partnerId);

    return successResponse(
        res,
        200,
        'Operator removed from favourites successfully'
    );
});

const getFavouriteOperatorStatus = asyncHandler(async (req, res) => {
    const customerId = req.user.id;
    const { partnerId } = req.params;

    const status = await favouriteService.getFavouriteOperatorStatus(
        customerId,
        partnerId
    );

    return successResponse(
        res,
        200,
        'Favourite operator status retrieved successfully',
        status
    );
});

module.exports = {
    getFavouriteOperators,
    addFavouriteOperator,
    removeFavouriteOperator,
    getFavouriteOperatorStatus
};