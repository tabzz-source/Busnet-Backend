const express = require('express');
const partnerBlogController = require('../../controllers/partner/partnerBlog.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const { PARTNER } = require('../../constants/roles');
const validate = require('../../middlewares/validate.middleware');
const { validateCreateBlog } = require('../../validations/blog.validation');

const router = express.Router();

router.get('/', authenticate, restrictTo(PARTNER), partnerBlogController.getMyBlogs);
router.post('/', authenticate, restrictTo(PARTNER), validateCreateBlog, validate, partnerBlogController.createBlog);
router.get('/:id', authenticate, restrictTo(PARTNER), partnerBlogController.getBlogDetail);
router.patch('/:id', authenticate, restrictTo(PARTNER), validateCreateBlog, validate, partnerBlogController.updateBlog);
router.delete('/:id', authenticate, restrictTo(PARTNER), partnerBlogController.deleteBlog);

module.exports = router;
