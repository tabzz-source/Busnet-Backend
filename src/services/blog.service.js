const BlogPost = require('../models/BlogPost');
const AppError = require('../utils/AppError');
const PartnerInformation = require('../models/PartnerInformation');
const Account = require('../models/Account');

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

/**
 * Get all blog posts for a specific partner with pagination and filters
 */
const getPartnerBlogs = async (partnerId, queryParams) => {
    const { page = 1, limit = 10, status, search, q } = queryParams;
    const filter = { authorId: partnerId };
    const searchQuery = search || q;

    if (status) {
        filter.status = status;
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
            .sort({ createdAt: -1 })
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

const slugify = (text) => {
    if (!text) return '';
    let slug = text.toString().toLowerCase().trim();
    
    // Remove Vietnamese accents
    slug = slug.replace(/[áàảãạăắằẳẵặâấầẩẫậ]/g, 'a');
    slug = slug.replace(/[éèẻẽẹêếềểễệ]/g, 'e');
    slug = slug.replace(/[íìỉĩị]/g, 'i');
    slug = slug.replace(/[óòỏõọôốồổỗộơớờởỡợ]/g, 'o');
    slug = slug.replace(/[úùủũụưứừửữự]/g, 'u');
    slug = slug.replace(/[ýỳỷỹỵ]/g, 'y');
    slug = slug.replace(/đ/g, 'd');
    
    // Remove special characters, replace spaces with -
    slug = slug.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
        .replace(/\s+/g, '-') // collapse whitespace and replace by -
        .replace(/-+/g, '-'); // collapse dashes
        
    return slug;
};

const generateUniqueSlug = async (title) => {
    let slug = slugify(title);
    let originalSlug = slug;
    let count = 1;
    
    while (await BlogPost.findOne({ slug })) {
        slug = `${originalSlug}-${count}`;
        count++;
    }
    
    return slug;
};

/**
 * Create a new blog post for a partner
 */
const createPartnerBlog = async (partnerId, blogData) => {
    const { title, content, markdown, summary, coverImage, tag, status = 'PENDING_APPROVAL', metaTitle, metaDescription } = blogData;
    
    const slug = await generateUniqueSlug(title);
    
    const partner = await Account.findById(partnerId);
    
    let finalStatus = status || 'PENDING_APPROVAL';
    let publishedAt = null;
    
    if (partner && partner.isAutoPublishBlog && finalStatus === 'PENDING_APPROVAL') {
        finalStatus = 'PUBLISHED';
        publishedAt = new Date();
    }
    
    const blog = await BlogPost.create({
        title,
        slug,
        content,
        markdown,
        summary,
        coverImage,
        tag: tag || 'General',
        authorId: partnerId,
        status: finalStatus,
        publishedAt,
        metaTitle: metaTitle || title,
        metaDescription: metaDescription || summary || ''
    });
    
    return blog;
};

/**
 * Get details of a blog post owned by a partner
 */
const getPartnerBlogDetail = async (partnerId, blogId) => {
    const blog = await BlogPost.findOne({ _id: blogId, authorId: partnerId });
    if (!blog) {
        throw new AppError('Blog post not found.', 404);
    }
    return blog;
};

/**
 * Update an existing blog post owned by a partner
 */
const updatePartnerBlog = async (partnerId, blogId, updateData) => {
    const blog = await BlogPost.findOne({ _id: blogId, authorId: partnerId });
    if (!blog) {
        throw new AppError('Blog post not found.', 404);
    }

    if (blog.status === 'PENDING_APPROVAL') {
        throw new AppError('Cannot edit a blog post that is pending approval.', 400);
    }

    const { title, content, markdown, summary, coverImage, tag, status, metaTitle, metaDescription } = updateData;

    if (title && title !== blog.title) {
        blog.title = title.trim();
        blog.slug = await generateUniqueSlug(title.trim());
    }

    if (content !== undefined) blog.content = content;
    if (markdown !== undefined) blog.markdown = markdown;
    if (summary !== undefined) blog.summary = summary.trim();
    if (coverImage !== undefined) blog.coverImage = coverImage;
    if (tag !== undefined) blog.tag = tag;
    
    const partner = await Account.findById(partnerId);
    let targetStatus = status;
    if (!targetStatus && (blog.status === 'PUBLISHED' || blog.status === 'REJECTED')) {
        targetStatus = 'PENDING_APPROVAL';
    }

    if (partner && partner.isAutoPublishBlog && targetStatus === 'PENDING_APPROVAL') {
        blog.status = 'PUBLISHED';
        blog.publishedAt = new Date();
    } else if (targetStatus) {
        blog.status = targetStatus;
        if (targetStatus === 'PUBLISHED') {
            blog.publishedAt = new Date();
        }
    }

    if (metaTitle !== undefined) blog.metaTitle = metaTitle ? metaTitle.trim() : blog.title;
    if (metaDescription !== undefined) blog.metaDescription = metaDescription ? metaDescription.trim() : (summary ? summary.trim() : '');

    await blog.save();
    return blog;
};

/**
 * Delete a blog post owned by a partner
 */
const deletePartnerBlog = async (partnerId, blogId) => {
    const blog = await BlogPost.findOne({ _id: blogId, authorId: partnerId });
    if (!blog) {
        throw new AppError('Blog post not found.', 404);
    }
    if (blog.status === 'PUBLISHED') {
        throw new AppError('Cannot delete a published blog post. Please revert it to Draft first.', 400);
    }
    await BlogPost.findByIdAndDelete(blogId);
    return blog;
};

// ============================
// ADMIN BLOG MANAGEMENT
// ============================

/**
 * Get all pending blogs for admin review with pagination
 */
const getAdminPendingBlogs = async (queryParams) => {
    const { page = 1, limit = 10, search } = queryParams;
    const filter = { status: 'PENDING_APPROVAL' };

    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { summary: { $regex: search, $options: 'i' } }
        ];
    }

    const skipIndex = (page - 1) * limit;
    const [blogs, totalBlogs] = await Promise.all([
        BlogPost.find(filter)
            .populate('authorId', 'fullName email profilePicture')
            .sort({ createdAt: -1 })
            .skip(skipIndex)
            .limit(Number(limit)),
        BlogPost.countDocuments(filter)
    ]);

    // Fetch partner names (operatorName) from PartnerInformation for all authors
    const authorIds = blogs.map(blog => blog.authorId ? blog.authorId._id : null).filter(Boolean);
    const partnerInfos = await PartnerInformation.find({ accountId: { $in: authorIds } });
    const partnerInfoMap = {};
    partnerInfos.forEach(info => {
        partnerInfoMap[info.accountId.toString()] = info.operatorName;
    });

    const blogsWithPartnerName = blogs.map(blog => {
        const blogObj = blog.toObject();
        if (blogObj.authorId) {
            const authorIdStr = blogObj.authorId._id.toString();
            blogObj.partnerName = partnerInfoMap[authorIdStr] || null;
        }
        return blogObj;
    });

    const totalPages = Math.ceil(totalBlogs / limit);

    return {
        blogs: blogsWithPartnerName,
        pagination: {
            totalItems: totalBlogs,
            totalPages,
            currentPage: Number(page),
            limit: Number(limit)
        }
    };
};

/**
 * Approve a blog post (Admin)
 */
const adminApproveBlog = async (blogId, adminId) => {
    const blog = await BlogPost.findById(blogId);
    if (!blog) {
        throw new AppError('Blog post not found.', 404);
    }
    if (blog.status !== 'PENDING_APPROVAL') {
        throw new AppError('Only pending blogs can be approved.', 400);
    }

    blog.status = 'PUBLISHED';
    blog.approvedBy = adminId;
    blog.publishedAt = new Date();
    blog.rejectionReason = null;
    await blog.save();

    // Check if the partner has reached 10 consecutive approved blogs
    const recentBlogs = await BlogPost.find({
        authorId: blog.authorId,
        status: { $in: ['PUBLISHED', 'REJECTED'] }
    }).sort({ updatedAt: -1 }).limit(10);

    // If there are at least 10 blogs, and all of them are PUBLISHED (approved)
    if (recentBlogs.length >= 10 && recentBlogs.every(b => b.status === 'PUBLISHED')) {
        await Account.findByIdAndUpdate(blog.authorId, { isAutoPublishBlog: true });
    }

    return blog;
};

/**
 * Reject a blog post (Admin)
 */
const adminRejectBlog = async (blogId, reason) => {
    const blog = await BlogPost.findById(blogId);
    if (!blog) {
        throw new AppError('Blog post not found.', 404);
    }
    if (blog.status !== 'PENDING_APPROVAL') {
        throw new AppError('Only pending blogs can be rejected.', 400);
    }

    blog.status = 'REJECTED';
    blog.rejectionReason = reason || null;
    await blog.save();

    // Reset isAutoPublishBlog to false because a blog got rejected
    await Account.findByIdAndUpdate(blog.authorId, { isAutoPublishBlog: false });

    return blog;
};

module.exports = {
    getPublishedBlogs,
    getPublishedBlogDetail,
    getPartnerBlogs,
    createPartnerBlog,
    getPartnerBlogDetail,
    updatePartnerBlog,
    deletePartnerBlog,
    getAdminPendingBlogs,
    adminApproveBlog,
    adminRejectBlog
};