const BlogPost = require('../models/BlogPost');
const AppError = require('../utils/AppError');

// Get all blog posts with pagination
const getPublishedBlogs = async (queryParams) => {
    const { page = 1, limit = 10, category, search, q } = queryParams;
    const filter = { status: 'PUBLISHED' };
    const searchQuery = search || q;

    // Filter by tag
    if (category) {
        filter.tag = { $regex: category, $options: 'i' };
    }

    if (searchQuery) {
        filter.$or = [
            { title: { $regex: searchQuery, $options: 'i' } },
            { summary: { $regex: searchQuery, $options: 'i' } }
        ];
    }

    const skipIndex = (page - 1) * limit;
    const [blogs, totalBlogs] = await Promise.all([
        BlogPost.find(filter)
            .populate('authorId', 'fullName profilePicture')
            .sort({ publishedAt: -1 })
            .skip(skipIndex)
            .limit(Number(limit)),
        BlogPost.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalBlogs / limit);

    return {
        blogs,
        pagination: {
            totalItems: totalBlogs,
            totalPages,
            currentPage: Number(page),
            limit: Number(limit)
        }
    };
};

/**
 * Get published blog details by ID or Slug & increment views count
 */
const getPublishedBlogDetail = async (identifier) => {
    const query = identifier.match(/^[0-9a-fA-H]{24}$/i)
        ? { _id: identifier, status: 'PUBLISHED' }
        : { slug: identifier, status: 'PUBLISHED' };
    const blog = await BlogPost.findOneAndUpdate(
        query,
        { $inc: { views: 1 } },
        { returnDocument: 'after' }
    ).populate('authorId', 'fullName profilePicture');
    if (!blog) {
        throw new AppError('Blog article not found or has not been published yet.', 404);
    }
    return blog;
};
module.exports = {
    getPublishedBlogs,
    getPublishedBlogDetail
};