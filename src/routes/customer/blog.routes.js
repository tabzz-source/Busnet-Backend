const express = require('express');
const customerBlogController = require('../../controllers/customer/customerBlog.controller');

const router = express.Router();

router.get('/', customerBlogController.getAllBlogs);
router.get('/:identifier', customerBlogController.getBlogDetail);

module.exports = router;
