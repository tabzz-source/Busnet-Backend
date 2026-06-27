const blogService = require('../../services/blog.service');

const getMyBlogs = async (req, res) => {
    try {
        const partnerId = req.user?.id || req.user?._id;
        
        if (!partnerId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const result = await blogService.getPartnerBlogs(partnerId, req.query);

        return res.status(200).json({
            success: true,
            message: 'Blogs retrieved successfully',
            ...result
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

const createBlog = async (req, res) => {
    try {
        const partnerId = req.user?.id || req.user?._id;
        
        if (!partnerId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const blog = await blogService.createPartnerBlog(partnerId, req.body);

        return res.status(201).json({
            success: true,
            message: 'Blog post created successfully',
            data: blog
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

const getBlogDetail = async (req, res) => {
    try {
        const partnerId = req.user?.id || req.user?._id;
        const { id } = req.params;
        
        if (!partnerId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const blog = await blogService.getPartnerBlogDetail(partnerId, id);

        return res.status(200).json({
            success: true,
            message: 'Blog detail retrieved successfully',
            data: blog
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

const updateBlog = async (req, res) => {
    try {
        const partnerId = req.user?.id || req.user?._id;
        const { id } = req.params;
        
        if (!partnerId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const blog = await blogService.updatePartnerBlog(partnerId, id, req.body);

        return res.status(200).json({
            success: true,
            message: 'Blog post updated successfully',
            data: blog
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteBlog = async (req, res) => {
    try {
        const partnerId = req.user?.id || req.user?._id;
        const { id } = req.params;
        
        if (!partnerId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        await blogService.deletePartnerBlog(partnerId, id);

        return res.status(200).json({
            success: true,
            message: 'Blog post deleted successfully'
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getMyBlogs,
    createBlog,
    getBlogDetail,
    updateBlog,
    deleteBlog
};
