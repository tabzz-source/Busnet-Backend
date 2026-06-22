const express = require('express');
const upload = require('../../middlewares/uploadMiddleware');
const uploadToCloudinary = require('../../utils/uploadToCloudinary');
const router = express.Router();

// POST /api/upload
router.post('/', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please select an image file to upload' });
        }
        
        const folder = req.query.folder || 'busnet_branding';
        const result = await uploadToCloudinary(req.file.buffer, folder);
        
        return res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            url: result.url,
            publicId: result.publicId
        });
    } catch (error) {
        console.error('Upload to Cloudinary error:', error);
        return res.status(500).json({ success: false, message: 'Failed to upload image' });
    }
});

module.exports = router;
