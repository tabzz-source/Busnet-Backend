const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const feedbackService = require('../../services/feedback.service');

const createFeedback = asyncHandler(async (req, res) => {
    const customerId = req.user.id;

    const feedback = await feedbackService.createFeedback(customerId, req.body);

    return successResponse(
        res,
        201,
        'Feedback created successfully',
        {
            feedback
        }
    );
});

const createOperatorFeedback = asyncHandler(async (req, res) => {
    const customerId = req.user.id;
    const { partnerId } = req.params;

    const feedback = await feedbackService.createOperatorFeedback(customerId, partnerId, req.body);

    return successResponse(
        res,
        201,
        'Operator feedback created successfully',
        {
            feedback
        }
    );
});

const getMyFeedbacks = asyncHandler(async (req, res) => {
    const customerId = req.user.id;

    const result = await feedbackService.getMyFeedbacks(customerId, req.query);

    return successResponse(
        res,
        200,
        'My feedbacks retrieved successfully',
        result
    );
});

const getFeedbacksByTrip = asyncHandler(async (req, res) => {
    const { tripId } = req.params;

    const result = await feedbackService.getFeedbacksByTrip(
        tripId,
        req.query
    );

    return successResponse(
        res,
        200,
        'Trip feedbacks retrieved successfully',
        result
    );
});

const getFeedbacksByPartner = asyncHandler(async (req, res) => {
    const { partnerId } = req.params;

    const result = await feedbackService.getFeedbacksByPartner(
        partnerId,
        req.query
    );

    return successResponse(
        res,
        200,
        'Operator feedbacks retrieved successfully',
        result
    );
});

module.exports = {
    createFeedback,
    createOperatorFeedback,
    getMyFeedbacks,
    getFeedbacksByTrip,
    getFeedbacksByPartner
};
