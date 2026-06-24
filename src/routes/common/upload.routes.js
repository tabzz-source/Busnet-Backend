const express = require('express');
const upload = require('../../middlewares/uploadMiddleware');
const uploadToCloudinary = require('../../utils/uploadToCloudinary');
const path = require('path');
const router = express.Router();

// POST /api/upload
router.post('/', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please select a file to upload' });
        }
        
        const folder = req.query.folder || 'busnet_branding';

        // Detect file type for Cloudinary resource_type
        const fileExt = path.extname(req.file.originalname || '').toLowerCase();
        const nonImageExts = ['.pdf', '.doc', '.docx'];
        const options = {};
        if (nonImageExts.includes(fileExt)) {
            options.resource_type = 'raw';
        }

        const result = await uploadToCloudinary(req.file.buffer, folder, options);
        
        return res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            url: result.url,
            publicId: result.publicId
        });
    } catch (error) {
        console.error('Upload to Cloudinary error:', error);
        return res.status(500).json({ success: false, message: 'Failed to upload file' });
    }
});

module.exports = router;

