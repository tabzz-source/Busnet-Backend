const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/avatars');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const uploadLocal = (fileBuffer, originalName) => {
    const ext = path.extname(originalName || '.png');
    const filename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    fs.writeFileSync(filePath, fileBuffer);

    return {
        url: `/uploads/avatars/${filename}`,
        filename,
    };
};

module.exports = uploadLocal;
