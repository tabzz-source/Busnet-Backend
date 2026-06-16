const blogService = require('../../services/blog.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

/**
 * GET /api/customer/blogs
 * View blog list for guests & customers
 */
const getAllBlogs = asyncHandler(async (req, res) => {
    const result = await blogService.getPublishedBlogs(req.query);
    return successResponse(res, 200, 'Blogs retrieved successfully', result);
});

/**
 * GET /api/customer/blogs/:identifier
 * View blog details by ID or Slug for guests & customers
 */
const getBlogDetail = asyncHandler(async (req, res) => {
    const { identifier } = req.params;
    const blog = await blogService.getPublishedBlogDetail(identifier);
    return successResponse(res, 200, 'Blog details retrieved successfully', blog);
});

module.exports = {
    getAllBlogs,
    getBlogDetail
};
