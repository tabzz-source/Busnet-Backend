const bcrypt = require('bcryptjs');
const Account = require('../models/Account');
const Admin = require('../models/Admin');
const CodeVerification = require('../models/CodeVerification');
const generateToken = require('../utils/generateToken');
const generateVerificationCode = require('../utils/generateCode');
const { addMinutes } = require('../utils/time');
const { CODE_VERIFICATION_TYPE } = require('../constants/statuses');
const AppError = require('../utils/AppError');
const { verifyGoogleToken } = require('./googleAuth.service');
const emailService = require('./email.service');

const BCRYPT_SALT_ROUNDS = 10;

// ============================
// REGISTER CUSTOMER
// ============================

/**
 * Register a new customer account
 *
 * Flow (inspired by Bonix pattern):
 * 1. Validate email uniqueness
 * 2. Validate username uniqueness
 * 3. Validate phone uniqueness
 * 4. Hash password with bcrypt
 * 5. Create Account with status UNVERIFIED
 * 6. Generate OTP 6-digit code
 * 7. Hash OTP and save to CodeVerification (expires in 10 minutes)
 * 8. Return account data + OTP (Phase 1: for Postman testing)
 *
 * @param {object} data - Registration data from request body
 * @returns {object} { account, verificationCode }
 * @throws {AppError} 409 if email/username/phone already exists
 */
const registerCustomer = async (data) => {
    const { username, email, password, fullName, phone, gender, dob } = data;

    // Step 1: Check email duplicate (only non-deleted CUSTOMER accounts)
    const existingEmail = await Account.findOne({
        email: email.toLowerCase(),
        deletedAt: null
    });
    if (existingEmail) {
        throw new AppError('This email is already registered', 409);
    }

    // Step 2: Check username duplicate
    const existingUsername = await Account.findOne({
        username,
        deletedAt: null
    });
    if (existingUsername) {
        throw new AppError('This username is already taken', 409);
    }

    // Step 3: Check phone duplicate
    const existingPhone = await Account.findOne({
        phone,
        deletedAt: null
    });
    if (existingPhone) {
        throw new AppError('This phone number is already registered', 409);
    }

    // Step 4: Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Step 5: Generate 6-digit OTP
    const verificationCode = generateVerificationCode();

    // Step 6: Hash OTP and save to CodeVerification (expires in 10 minutes)
    const codeHash = await bcrypt.hash(verificationCode, BCRYPT_SALT_ROUNDS);
    const expiredAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const pendingData = {
        username,
        email: email.toLowerCase(),
        phone,
        passwordHash,
        fullName,
        gender: gender || 'UNKNOWN',
        dob: dob ? new Date(dob) : undefined,
        role: 'CUSTOMER'
    };

    await CodeVerification.create({
        accountId: null,
        target: email.toLowerCase(),
        targetType: 'EMAIL',
        type: 'REGISTER',
        codeHash,
        expiredAt,
        pendingData
    });

    // Step 7: Send OTP via email and return data
    emailService.sendVerificationEmail(email.toLowerCase(), verificationCode)
        .catch(err => console.error('Failed to send verification email:', err));

    return {
        account: {
            username,
            email: email.toLowerCase(),
            phone,
            fullName,
            gender: gender || 'UNKNOWN',
            dob: dob ? new Date(dob) : undefined,
            role: 'CUSTOMER',
            status: 'UNVERIFIED',
            createdAt: new Date()
        },
        ...(process.env.NODE_ENV === 'development' ? { verificationCode } : {})
    };
};

// ============================
// LOGIN CUSTOMER
// ============================

const loginCustomer = async ({ identifier, password }) => {
    if (!identifier || !password) {
        throw new AppError('Please enter email/username and password', 400);
    }

    const account = await Account.findOne({
        $or: [
            { email: identifier.toLowerCase() },
            { username: identifier }
        ],
        role: 'CUSTOMER'
    }).select('+passwordHash');

    if (!account) {
        throw new AppError('Incorrect account or password', 401);
    }

    if (account.status === 'DELETED') {
        throw new AppError('This account has been deleted', 403);
    }

    if (account.status === 'BANNED') {
        throw new AppError('This account has been banned', 403);
    }

    if (account.status === 'UNVERIFIED') {
        throw new AppError('This account has not been verified. Please verify your email first', 403);
    }

    if (account.status !== 'ACTIVE') {
        throw new AppError('This account has not been activated', 403);
    }

    const isMatch = await bcrypt.compare(password, account.passwordHash);

    if (!isMatch) {
        throw new AppError('Incorrect account or password', 401);
    }

    const token = generateToken({
        accountId: account._id,
        role: account.role
    });

    return {
        token,
        account: {
            _id: account._id,
            username: account.username,
            email: account.email,
            phone: account.phone,
            fullName: account.fullName,
            role: account.role,
            status: account.status,
            profilePicture: account.profilePicture
        }
    };
};

// ============================
// GOOGLE LOGIN / REGISTER CUSTOMER
// ============================

/**
 * Login or register a customer using Google OAuth Token
 * @param {string} idToken - Google ID token from frontend
 * @returns {Promise<object>} { token, account }
 */
const loginGoogleCustomer = async (idToken) => {
    if (!idToken) {
        throw new AppError('Google ID Token is required', 400);
    }

    const payload = await verifyGoogleToken(idToken);
    const { sub: googleId, email, name, picture, email_verified } = payload;

    if (!email) {
        throw new AppError('Google account does not provide an email address', 400);
    }

    // Step 1: Find account by Google ID or by email
    let account = await Account.findOne({ googleId, deletedAt: null });

    if (!account) {
        // Find by email if googleId not found (link existing account)
        account = await Account.findOne({ email: email.toLowerCase(), deletedAt: null });

        if (account) {
            // Check if role is CUSTOMER
            if (account.role !== 'CUSTOMER') {
                throw new AppError('Google login is only available for Customer accounts', 403);
            }
            // Link googleId to existing account
            account.googleId = googleId;
            account.isOAuthUser = true;
            if (email_verified) {
                account.isEmailVerified = true;
                if (account.status === 'UNVERIFIED') {
                    account.status = 'ACTIVE';
                }
            }
            if (picture && !account.profilePicture) {
                account.profilePicture = picture;
            }
            await account.save();
        }
    }

    // Step 2: Create new account if not found
    if (!account) {
        // Generate a random username or base it on email
        let baseUsername = email.split('@')[0];
        let username = baseUsername;
        let isUsernameTaken = await Account.findOne({ username, deletedAt: null });
        let counter = 1;
        while (isUsernameTaken) {
            username = `${baseUsername}${counter}`;
            isUsernameTaken = await Account.findOne({ username, deletedAt: null });
            counter++;
        }

        account = await Account.create({
            username,
            email: email.toLowerCase(),
            googleId,
            fullName: name,
            profilePicture: picture,
            role: 'CUSTOMER',
            status: email_verified ? 'ACTIVE' : 'UNVERIFIED',
            isOAuthUser: true,
            isEmailVerified: !!email_verified,
        });
    }

    // Step 3: Validate account status
    if (account.status === 'DELETED') {
        throw new AppError('This account has been deleted', 403);
    }

    if (account.status === 'BANNED') {
        throw new AppError('This account has been banned', 403);
    }

    // If Google account is verified, make sure account status is ACTIVE and verified
    if (email_verified && account.status === 'UNVERIFIED') {
        account.status = 'ACTIVE';
        account.isEmailVerified = true;
        await account.save();
    }

    if (account.status !== 'ACTIVE') {
        throw new AppError('This account has not been activated', 403);
    }

    // Step 4: Generate JWT token
    const token = generateToken({
        accountId: account._id,
        role: account.role
    });

    return {
        token,
        account: {
            _id: account._id,
            username: account.username,
            email: account.email,
            phone: account.phone,
            fullName: account.fullName,
            role: account.role,
            status: account.status,
            profilePicture: account.profilePicture
        }
    };
};

const loginPartner = async ({ identifier, password }) => {
    if (!identifier || !password) {
        throw new Error('Please enter email/phone number and password');
    }

    const account = await Account.findOne({
        $or: [
            { email: identifier.toLowerCase() },
            { phone: identifier }
        ],
        role: 'PARTNER'
    }).select('+passwordHash');

    if (!account) {
        throw new Error('Incorrect account or password');
    }

    if (account.status === 'DELETED') {
        throw new Error('This account has been deleted');
    }

    if (account.status === 'BANNED') {
        throw new Error('This account has been banned');
    }

    if (account.status === 'PENDING_APPROVAL') {
        throw new Error('Your account is pending approval from admin');
    }

    if (account.status !== 'ACTIVE') {
        throw new Error('This account has not been activated');
    }

    const isMatch = await bcrypt.compare(password, account.passwordHash);

    if (!isMatch) {
        throw new Error('Incorrect account or password');
    }

    const token = generateToken({
        accountId: account._id,
        role: account.role
    });

    return {
        token,
        account: {
            _id: account._id,
            username: account.username,
            email: account.email,
            phone: account.phone,
            fullName: account.fullName,
            role: account.role,
            status: account.status,
            profilePicture: account.profilePicture
        }
    };
};

module.exports = {
    loginCustomer,
    loginPartner
};
// ============================
// VERIFY EMAIL
// ============================

/**
 * Verify a customer's email address using OTP
 * @param {string} email
 * @param {string} code
 * @returns {Promise<object>} updated account
 */
const verifyEmail = async (email, code) => {
    if (!email || !code) {
        throw new AppError('Email and verification code are required', 400);
    }

    // Find the latest active verification code of type 'REGISTER' for this email
    const verification = await CodeVerification.findOne({
        target: email.toLowerCase(),
        targetType: 'EMAIL',
        type: 'REGISTER',
        used: false,
        expiredAt: { $gt: new Date() }
    }).select('+codeHash');

    if (!verification) {
        throw new AppError('Invalid or expired verification code', 400);
    }

    // Check attempt limit
    if (verification.attemptCount >= verification.maxAttempts) {
        throw new AppError('Too many failed attempts. Please register again or request a new code.', 400);
    }

    // Verify code
    const isMatch = await bcrypt.compare(code, verification.codeHash);
    if (!isMatch) {
        verification.attemptCount += 1;
        await verification.save();
        throw new AppError('Incorrect verification code', 400);
    }

    let account;
    if (verification.pendingData) {
        const { username, email: pendingEmail, phone, passwordHash, fullName, gender, dob, role } = verification.pendingData;

        // Double check duplication to prevent race conditions
        const existingEmail = await Account.findOne({ email: pendingEmail.toLowerCase(), deletedAt: null });
        if (existingEmail) {
            throw new AppError('This email is already registered', 409);
        }

        const existingUsername = await Account.findOne({ username, deletedAt: null });
        if (existingUsername) {
            throw new AppError('This username is already taken', 409);
        }

        const existingPhone = await Account.findOne({ phone, deletedAt: null });
        if (existingPhone) {
            throw new AppError('This phone number is already registered', 409);
        }

        account = await Account.create({
            username,
            email: pendingEmail.toLowerCase(),
            phone,
            passwordHash,
            fullName,
            gender: gender || 'UNKNOWN',
            dob: dob ? new Date(dob) : undefined,
            role: role || 'CUSTOMER',
            status: 'ACTIVE',
            isEmailVerified: true,
            isPhoneVerified: false
        });
    } else {
        // Fallback for older registers where Account was created on register step
        account = await Account.findOneAndUpdate(
            { email: email.toLowerCase(), deletedAt: null },
            { 
                status: 'ACTIVE', 
                isEmailVerified: true 
            },
            { returnDocument: 'after' }
        );
    }

    if (!account) {
        throw new AppError('Account not found', 404);
    }

    // Code is valid! Mark as used only after account creation/update succeeds
    verification.used = true;
    verification.usedAt = new Date();
    await verification.save();

    return account;
};

// ============================
// FORGOT PASSWORD
// ============================

/**
 * Forgot password - generates OTP and emails it to the user
 * @param {string} email
 */
const forgotPassword = async (email) => {
    if (!email) {
        throw new AppError('Email is required', 400);
    }

    // Find the customer account
    const account = await Account.findOne({
        email: email.toLowerCase(),
        role: 'CUSTOMER',
        deletedAt: null
    });

    if (!account) {
        // Check if there is an unused registration code verification for this email
        const registerVerification = await CodeVerification.findOne({
            target: email.toLowerCase(),
            targetType: 'EMAIL',
            type: 'REGISTER',
            used: false
        }).sort({ createdAt: -1 });

        if (registerVerification && registerVerification.pendingData) {
            const verificationCode = generateVerificationCode();
            const codeHash = await bcrypt.hash(verificationCode, BCRYPT_SALT_ROUNDS);
            const expiredAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            await CodeVerification.create({
                accountId: null,
                target: email.toLowerCase(),
                targetType: 'EMAIL',
                type: 'REGISTER',
                codeHash,
                expiredAt,
                pendingData: registerVerification.pendingData
            });

            emailService.sendVerificationEmail(email.toLowerCase(), verificationCode)
                .catch(err => console.error('Failed to send verification email:', err));

            return { message: 'Verification code has been resent to your email.' };
        }

        throw new AppError('Account with this email does not exist', 404);
    }

    if (account.status === 'BANNED' || account.status === 'DELETED') {
        throw new AppError('This account is suspended or deleted', 403);
    }

    // Generate 6-digit OTP code
    const verificationCode = generateVerificationCode();
    const codeHash = await bcrypt.hash(verificationCode, BCRYPT_SALT_ROUNDS);
    const expiredAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in CodeVerification
    // If the account is UNVERIFIED, we generate a REGISTER code so they can verify and activate
    const codeType = account.status === 'UNVERIFIED' ? 'REGISTER' : 'RESET_PASSWORD';
    await CodeVerification.create({
        accountId: account._id,
        target: email.toLowerCase(),
        targetType: 'EMAIL',
        type: codeType,
        codeHash,
        expiredAt
    });

    // Send email based on account status
    if (account.status === 'UNVERIFIED') {
        emailService.sendVerificationEmail(email.toLowerCase(), verificationCode)
            .catch(err => console.error('Failed to send verification email:', err));
    } else {
        emailService.sendPasswordResetEmail(email.toLowerCase(), verificationCode)
            .catch(err => console.error('Failed to send password reset email:', err));
    }

    return { message: account.status === 'UNVERIFIED' ? 'Verification code has been resent to your email.' : 'Password reset code has been sent to your email.' };
};

// ============================
// VERIFY RESET CODE
// ============================

/**
 * Verify if reset code is valid (frontend can check this before showing form)
 * @param {string} email
 * @param {string} code
 * @returns {Promise<boolean>}
 */
const verifyResetCode = async (email, code) => {
    if (!email || !code) {
        throw new AppError('Email and code are required', 400);
    }

    const verification = await CodeVerification.findOne({
        target: email.toLowerCase(),
        targetType: 'EMAIL',
        type: 'RESET_PASSWORD',
        used: false,
        expiredAt: { $gt: new Date() }
    }).select('+codeHash');

    if (!verification) {
        throw new AppError('Invalid or expired verification code', 400);
    }

    if (verification.attemptCount >= verification.maxAttempts) {
        throw new AppError('Too many failed attempts.', 400);
    }

    const isMatch = await bcrypt.compare(code, verification.codeHash);
    if (!isMatch) {
        verification.attemptCount += 1;
        await verification.save();
        throw new AppError('Incorrect verification code', 400);
    }

    return true;
};

// ============================
// RESET PASSWORD
// ============================

/**
 * Reset password using the verification OTP code
 * @param {string} email
 * @param {string} code
 * @param {string} newPassword
 */
const resetPassword = async (email, code, newPassword) => {
    if (!email || !code || !newPassword) {
        throw new AppError('Email, code, and new password are required', 400);
    }

    // 1. Verify code
    const verification = await CodeVerification.findOne({
        target: email.toLowerCase(),
        targetType: 'EMAIL',
        type: 'RESET_PASSWORD',
        used: false,
        expiredAt: { $gt: new Date() }
    }).select('+codeHash');

    if (!verification) {
        throw new AppError('Invalid or expired verification code', 400);
    }

    if (verification.attemptCount >= verification.maxAttempts) {
        throw new AppError('Too many failed attempts.', 400);
    }

    const isMatch = await bcrypt.compare(code, verification.codeHash);
    if (!isMatch) {
        verification.attemptCount += 1;
        await verification.save();
        throw new AppError('Incorrect verification code', 400);
    }

    // 2. Code is valid! Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // 3. Update the account password
    const account = await Account.findOneAndUpdate(
        { email: email.toLowerCase(), deletedAt: null },
        { passwordHash },
        { returnDocument: 'after' }
    );

    if (!account) {
        throw new AppError('Account not found', 404);
    }

    // 4. Mark code as used
    verification.used = true;
    verification.usedAt = new Date();
    await verification.save();

    return { message: 'Password has been reset successfully.' };
};

// ============================
// ADMIN: LOGIN
// ============================

const loginAdmin = async ({ email, password }) => {
    if (!email || !password) {
        throw new Error('Please enter email and password');
    }

    const admin = await Admin.findOne({
        email: email.toLowerCase()
    }).select('+passwordHash');

    if (!admin) {
        throw new Error('Incorrect account or password');
    }

    if (admin.status !== 'ACTIVE') {
        throw new Error('This account has been disabled');
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);

    if (!isMatch) {
        throw new Error('Incorrect account or password');
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = generateToken({ accountId: admin._id, role: admin.role });

    return {
        token,
        admin: {
            _id: admin._id,
            username: admin.username,
            email: admin.email,
            fullName: admin.fullName,
            role: admin.role,
            status: admin.status,
            avatar: admin.avatar,
            lastLoginAt: admin.lastLoginAt
        }
    };
};

// ============================
// ADMIN: VERIFY EMAIL
// ============================

const sendVerifyEmailAdmin = async (adminId) => {
    const admin = await Admin.findById(adminId);

    if (!admin) {
        throw new Error('Admin not found');
    }

    if (admin.isEmailVerified) {
        throw new Error('Email has already been verified');
    }

    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_SALT_ROUNDS);

    await CodeVerification.create({
        target: admin.email,
        targetType: 'EMAIL',
        type: CODE_VERIFICATION_TYPE.VERIFY_EMAIL,
        codeHash,
        expiredAt: addMinutes(new Date(), 10)
    });

    await emailService.sendVerificationEmail(admin.email, code);

    return { message: 'Verification code has been sent to your email' };
};

const verifyEmailAdmin = async (adminId, code) => {
    const admin = await Admin.findById(adminId);

    if (!admin) {
        throw new Error('Admin not found');
    }

    if (admin.isEmailVerified) {
        throw new Error('Email has already been verified');
    }

    const record = await CodeVerification.findOne({
        target: admin.email,
        type: CODE_VERIFICATION_TYPE.VERIFY_EMAIL,
        used: false,
        expiredAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).select('+codeHash');

    if (!record) {
        throw new Error('Verification code is invalid or has expired');
    }

    if (record.attemptCount >= record.maxAttempts) {
        throw new Error('Too many attempts, please request a new code');
    }

    const isMatch = await bcrypt.compare(code, record.codeHash);

    if (!isMatch) {
        record.attemptCount += 1;
        await record.save();
        throw new Error('Invalid verification code');
    }

    record.used = true;
    record.usedAt = new Date();
    await record.save();

    admin.isEmailVerified = true;
    await admin.save();

    return { message: 'Email verified successfully' };
};

// ============================
// ADMIN: FORGOT / RESET PASSWORD
// ============================

const forgotPasswordAdmin = async (email) => {
    if (!email) {
        throw new Error('Please enter your email');
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
        throw new Error('No admin account found with this email');
    }

    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_SALT_ROUNDS);

    await CodeVerification.create({
        target: admin.email,
        targetType: 'EMAIL',
        type: CODE_VERIFICATION_TYPE.RESET_PASSWORD,
        codeHash,
        expiredAt: addMinutes(new Date(), 15)
    });

    await emailService.sendPasswordResetEmail(admin.email, code);

    return { message: 'Password reset code has been sent to your email' };
};

const resetPasswordAdmin = async ({ email, code, newPassword }) => {
    if (!email || !code || !newPassword) {
        throw new Error('Please provide email, code and new password');
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
        throw new Error('No admin account found with this email');
    }

    const record = await CodeVerification.findOne({
        target: admin.email,
        type: CODE_VERIFICATION_TYPE.RESET_PASSWORD,
        used: false,
        expiredAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).select('+codeHash');

    if (!record) {
        throw new Error('Reset code is invalid or has expired');
    }

    if (record.attemptCount >= record.maxAttempts) {
        throw new Error('Too many attempts, please request a new code');
    }

    const isMatch = await bcrypt.compare(code, record.codeHash);

    if (!isMatch) {
        record.attemptCount += 1;
        await record.save();
        throw new Error('Invalid reset code');
    }

    record.used = true;
    record.usedAt = new Date();
    await record.save();

    admin.passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await admin.save();

    return { message: 'Password has been reset successfully' };
};

module.exports = {
    registerCustomer,
    loginCustomer,
    loginGoogleCustomer,
    verifyEmail,
    forgotPassword,
    verifyResetCode,
    resetPassword,
    loginAdmin,
    sendVerifyEmailAdmin,
    verifyEmailAdmin,
    forgotPasswordAdmin,
    resetPasswordAdmin
};
