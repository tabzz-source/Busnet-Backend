const crypto = require('crypto');

// Get Secret Key and hash it to exactly 32 bytes (256 bits) for AES-256
const getSecretKey = () => {
    const secret = process.env.SEPAY_CRYPTO_SECRET || 'busnet_default_fallback_secret_32';
    return crypto.createHash('sha256').update(String(secret)).digest();
};

const algorithm = 'aes-256-cbc';
const ivLength = 16; // AES block size is always 16 bytes

/**
 * Encrypt a plain text string using AES-256-CBC
 * @param {string} text Plain text to encrypt
 * @returns {string} Encrypted string in format "iv:encryptedData"
 */
const encrypt = (text) => {
    if (!text) return null;
    
    const iv = crypto.randomBytes(ivLength);
    const key = getSecretKey();
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
};

/**
 * Decrypt an encrypted string (in format "iv:encryptedData") using AES-256-CBC
 * @param {string} encryptedText Encrypted text to decrypt
 * @returns {string} Original plain text
 */
const decrypt = (encryptedText) => {
    if (!encryptedText) return null;
    
    try {
        const parts = encryptedText.split(':');
        if (parts.length !== 2) return null;
        
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedData = Buffer.from(parts[1], 'hex');
        const key = getSecretKey();
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error.message);
        return null;
    }
};

module.exports = {
    encrypt,
    decrypt
};
