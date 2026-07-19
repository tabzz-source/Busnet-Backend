const PartnerInformation = require('../models/PartnerInformation');
const sepayCrypto = require('../utils/sepayCrypto');
const fs = require('fs');
const path = require('path');

const sepayAuthMiddleware = async (req, res, next) => {
    try {
        // Log incoming webhook request details to file for diagnostics
        try {
            const logData = {
                timestamp: new Date().toISOString(),
                method: req.method,
                url: req.originalUrl,
                headers: req.headers,
                body: req.body,
                query: req.query
            };
            const logFilePath = path.join(__dirname, '../../sepay_webhook_debug.log');
            fs.appendFileSync(logFilePath, JSON.stringify(logData, null, 2) + '\n---NEW_REQUEST---\n');
            console.log(`[SePay Webhook Diagnostic] Logged request to sepay_webhook_debug.log`);
        } catch (logError) {
            console.error('Failed to write SePay debug log:', logError);
        }

        const authHeader = req.headers['authorization'];
        let extractedKey = '';

        // 1. Extract from Authorization Header (Case-insensitive prefix check)
        if (authHeader) {
            const match = authHeader.match(/^(?:Apikey|ApiKey|apikey|APIKEY)\s+(.+)$/i);
            if (match) {
                extractedKey = match[1].trim();
            }
        }

        // 2. Fallback: Extract from Body Payload
        if (!extractedKey && req.body && req.body.apiKey) {
            extractedKey = req.body.apiKey;
        }

        if (!extractedKey) {
            return res.status(401).json({
                success: false,
                message: 'Authentication Failed: Missing SePay API Key'
            });
        }

        // 3. Check against Admin global API Key (For subscription package purchases)
        const adminApiKey = process.env.ADMIN_SEPAY_API_KEY;
        if (adminApiKey && extractedKey === adminApiKey) {
            req.isSePayAdmin = true;
            return next();
        }

        // Bypass check for SePay test webhooks (Gửi thử)
        if (req.body && req.body.code === 'SEPAYTEST') {
            console.log('[SePay Webhook Diagnostic] Bypassing auth check for SePay test webhook.');
            req.isSePayAdmin = false;
            return next();
        }

        // 4. Check against Partner API Key (For passenger ticket purchases)
        const vaNumber = req.body.subAccount;
        const accNumber = req.body.accountNumber;

        if (!vaNumber && !accNumber) {
            return res.status(401).json({
                success: false,
                message: 'Authentication Failed: Missing account identifiers (subAccount or accountNumber)'
            });
        }

        const query = [];
        if (vaNumber) {
            query.push({ sepayVa: vaNumber });
        }
        if (accNumber) {
            query.push({ bankNumber: accNumber });
        }

        const partner = await PartnerInformation.findOne({ $or: query }).select('+sepayKeyEncrypted');
        if (!partner) {
            return res.status(401).json({
                success: false,
                message: 'Authentication Failed: No partner matches the provided account identifiers'
            });
        }

        let decryptedKey = partner.sepayKeyEncrypted;
        if (decryptedKey && decryptedKey.includes(':')) {
            try {
                const decrypted = sepayCrypto.decrypt(decryptedKey);
                if (decrypted) {
                    decryptedKey = decrypted;
                }
            } catch (err) {
                console.error('Failed to decrypt fallback key:', err);
            }
        }
        if (!decryptedKey || decryptedKey !== extractedKey) {
            return res.status(401).json({
                success: false,
                message: 'Authentication Failed: SePay API Key mismatch'
            });
        }

        req.isSePayAdmin = false;
        req.sepayPartner = partner;
        next();
    } catch (error) {
        console.error('SePay authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during SePay authentication'
        });
    }
};

module.exports = sepayAuthMiddleware;
