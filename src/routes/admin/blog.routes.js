const express = require('express');
const router = express.Router();
const adminBlogController = require('../../controllers/admin/adminBlog.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const { ADMIN } = require('../../constants/roles');

// All admin routes require authentication and ADMIN role
router.use(protect, restrictTo(ADMIN));

// Get list of pending blogs for review
router.get('/pending', adminBlogController.getPendingBlogs);

// Approve a blog post
router.patch('/:id/approve', adminBlogController.approveBlog);

// Reject a blog post with optional reason
router.patch('/:id/reject', adminBlogController.rejectBlog);

module.exports = router;
