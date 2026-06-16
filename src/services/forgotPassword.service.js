const bcrypt = require('bcryptjs');
const Account = require('../models/Account');
const CodeVerification = require('../models/CodeVerification');
const generateCode = require('../utils/generateCode');

class ForgotPasswordService {
    /**
     * Send password reset code to email
     */
    async sendResetCode(email) {
        try {
            if (!email) {
                const error = new Error('Email is required');
                error.statusCode = 400;
                throw error;
            }

            const account = await Account.findOne({
                email: email.toLowerCase(),
                role: 'PARTNER'
            });

            if (!account) {
                const error = new Error('Partner account not found');
                error.statusCode = 404;
                throw error;
            }

            if (account.status === 'DELETED') {
                const error = new Error('This account has been deleted');
                error.statusCode = 400;
                throw error;
            }

            if (account.status === 'BANNED') {
                const error = new Error('This account has been banned');
                error.statusCode = 400;
                throw error;
            }

            // Generate reset code
            const code = generateCode(6);
            const salt = await bcrypt.genSalt(10);
            const codeHash = await bcrypt.hash(code, salt);

            // Create expiration time (30 minutes)
            const expiredAt = new Date(Date.now() + 30 * 60 * 1000);

            // Delete old reset codes
            await CodeVerification.deleteMany({
                accountId: account._id,
                targetType: 'EMAIL',
                type: 'RESET_PASSWORD',
                used: false
            });

            // Save reset code
            await CodeVerification.create({
                accountId: account._id,
                target: account.email,
                targetType: 'EMAIL',
                type: 'RESET_PASSWORD',
                codeHash,
                expiredAt,
                maxAttempts: 5
            });

            // TODO: Send email with reset code
            await emailService.sendPasswordResetEmail(account.email, code);
            return {
                message: 'Password reset code sent to your email',
                email: account.email
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Verify code and reset password
     */
    async resetPassword(email, code, newPassword) {
        try {
            if (!email || !code || !newPassword) {
                const error = new Error('Email, code, and new password are required');
                error.statusCode = 400;
                throw error;
            }

            if (newPassword.length < 6) {
                const error = new Error('Password must be at least 6 characters');
                error.statusCode = 400;
                throw error;
            }

            const account = await Account.findOne({
                email: email.toLowerCase(),
                role: 'PARTNER'
            });

            if (!account) {
                const error = new Error('Partner account not found');
                error.statusCode = 404;
                throw error;
            }

            // Find the latest reset code
            const codeRecord = await CodeVerification.findOne({
                accountId: account._id,
                targetType: 'EMAIL',
                type: 'RESET_PASSWORD',
                used: false
            }).select('+codeHash').sort({ createdAt: -1 });

            if (!codeRecord) {
                const error = new Error('No reset code found. Please request a new one');
                error.statusCode = 404;
                throw error;
            }

            // Check if code is expired
            if (new Date() > codeRecord.expiredAt) {
                const error = new Error('Reset code has expired');
                error.statusCode = 400;
                throw error;
            }

            // Check attempt count
            if (codeRecord.attemptCount >= codeRecord.maxAttempts) {
                const error = new Error('Maximum reset attempts exceeded. Please request a new code');
                error.statusCode = 400;
                throw error;
            }

            // Verify code
            const isMatch = await bcrypt.compare(code, codeRecord.codeHash);

            if (!isMatch) {
                // Increment attempt count
                codeRecord.attemptCount += 1;
                await codeRecord.save();

                const remainingAttempts = codeRecord.maxAttempts - codeRecord.attemptCount;
                const error = new Error(`Incorrect reset code. ${remainingAttempts} attempts remaining`);
                error.statusCode = 400;
                throw error;
            }

            // Hash new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Update account password
            account.passwordHash = hashedPassword;
            await account.save();

            // Mark code as used
            codeRecord.used = true;
            codeRecord.usedAt = new Date();
            await codeRecord.save();

            return {
                message: 'Password reset successfully',
                account: {
                    _id: account._id,
                    email: account.email
                }
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Resend reset code
     */
    async resendResetCode(email) {
        try {
            // Delete old reset codes
            const account = await Account.findOne({
                email: email.toLowerCase(),
                role: 'PARTNER'
            });

            if (!account) {
                const error = new Error('Partner account not found');
                error.statusCode = 404;
                throw error;
            }

            await CodeVerification.deleteMany({
                accountId: account._id,
                targetType: 'EMAIL',
                type: 'RESET_PASSWORD',
                used: false
            });

            // Send new reset code
            return await this.sendResetCode(email);
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new ForgotPasswordService();
