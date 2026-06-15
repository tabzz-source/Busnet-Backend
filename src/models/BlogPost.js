const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true
        },
        content: {
            type: String,
            required: true
        },
        summary: {
            type: String,
            maxLength: 300
        },
        coverImage: {
            type: String,
            required: true
        },
        tag: {
            type: String,
            default: 'General'
        },
        authorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true
        },
        status: {
            type: String,
            enum: ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REJECTED'],
            default: 'DRAFT'
        },
        rejectionReason: {
            type: String,
            default: null
        },
        metaTitle: String,
        metaDescription: String,

        // Thống kê
        views: {
            type: Number,
            default: 0
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account' // Admin nào đã duyệt bài này
        },
        publishedAt: Date
    },
    {
        timestamps: true,
        collection: 'blog_post'
    }
);

module.exports = mongoose.model('BlogPost', blogPostSchema);
