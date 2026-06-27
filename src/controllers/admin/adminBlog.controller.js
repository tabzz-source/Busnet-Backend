const blogService = require('../../services/blog.service');
const BlogPost = require('../../models/BlogPost');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const { sendBlogApprovedEmail, sendBlogRejectedEmail } = require('../../services/email.service');

// GET /admin/blogs/pending
const getPendingBlogs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search } = req.query;
    const result = await blogService.getAdminPendingBlogs({ page, limit, search });

    return successResponse(res, 200, 'Pending blogs retrieved successfully', result);
});

// PATCH /admin/blogs/:id/approve
const approveBlog = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const blog = await blogService.adminApproveBlog(id, req.user._id);

    // Send approval email to the partner
    const populated = await BlogPost.findById(id).populate('authorId', 'email fullName');
    if (populated && populated.authorId && populated.authorId.email) {
        sendBlogApprovedEmail(populated.authorId.email, populated.title).catch((err) => {
            console.error('Failed to send blog approval email:', err.message);
        });
    }

    return successResponse(res, 200, 'Blog approved successfully', blog);
});

// PATCH /admin/blogs/:id/reject
const rejectBlog = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const blog = await blogService.adminRejectBlog(id, reason);

    // Send rejection email to the partner
    const populated = await BlogPost.findById(id).populate('authorId', 'email fullName');
    if (populated && populated.authorId && populated.authorId.email) {
        sendBlogRejectedEmail(populated.authorId.email, populated.title, reason).catch((err) => {
            console.error('Failed to send blog rejection email:', err.message);
        });
    }

    return successResponse(res, 200, 'Blog rejected successfully', blog);
});

module.exports = {
    getPendingBlogs,
    approveBlog,
    rejectBlog
};
