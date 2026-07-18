const bcrypt = require('bcryptjs');
const Account = require('../models/Account');
const CodeVerification = require('../models/CodeVerification');
const generateToken = require('../utils/generateToken');
const generateVerificationCode = require('../utils/generateCode');
const { addMinutes } = require('../utils/time');
const { CODE_VERIFICATION_TYPE } = require('../constants/statuses');
const AppError = require('../utils/AppError');
const { verifyGoogleToken } = require('./googleAuth.service');
const emailService = require('./email.service');
const { resolveAccountStatus } = require('./banExpiry.service');

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
        account.status = await resolveAccountStatus(account._id, account.status);
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

    if (!account.passwordHash) {
        throw new AppError(
            'This account does not have a password set. Please use Google login or reset your password.',
            400
        );
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
        account.status = await resolveAccountStatus(account._id, account.status);
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

    if (!account.passwordHash) {
        throw new Error('This account does not have a password set');
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

    if (account.status === 'BANNED') {
        account.status = await resolveAccountStatus(account._id, account.status);
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

/**
 * Phase 1: Submit operator registration (Plan + Profile + License)
 * Creates Account (PENDING_APPROVAL) + PartnerInformation (licenseStatus: PENDING)
 * @param {object} data - Operator registration data (no bank/SePay info yet)
 * @returns {object} { account, partnerInfo }
 */
const submitOperatorRegistration = async (data) => {
    const SubscriptionPlan = require('../models/SubscriptionPlan');
    const PartnerInformation = require('../models/PartnerInformation');

    const {
        email, password, fullName, phone,
        operatorName, taxCode, planId,
        operatorPhone, description, amenities, policies,
        profilePicture, coverImage, businessLicense
    } = data;

    // 1. Verify plan exists and is active
    const plan = await SubscriptionPlan.findOne({ _id: planId, status: 'ACTIVE' });
    if (!plan) {
        throw new AppError('Subscription plan does not exist or is inactive', 404);
    }

    // 2. Validate email, phone duplication in Account
    const existingEmail = await Account.findOne({ email: email.toLowerCase(), deletedAt: null });
    if (existingEmail) {
        throw new AppError('This email is already registered', 409);
    }

    const existingPhone = await Account.findOne({ phone, deletedAt: null });
    if (existingPhone) {
        throw new AppError('This phone number is already registered', 409);
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // 4. Generate unique username
    let baseUsername = email.split('@')[0];
    let username = baseUsername;
    let isUsernameTaken = await Account.findOne({ username, deletedAt: null });
    let counter = 1;
    while (isUsernameTaken) {
        username = `${baseUsername}${counter}`;
        isUsernameTaken = await Account.findOne({ username, deletedAt: null });
        counter++;
    }

    // 5. Create Account with PENDING_APPROVAL status
    const account = await Account.create({
        username,
        email: email.toLowerCase(),
        phone,
        passwordHash,
        fullName,
        role: 'PARTNER',
        status: 'PENDING_APPROVAL',
        isEmailVerified: true,
        isPhoneVerified: false
    });

    // 6. Create PartnerInformation with licenseStatus PENDING
    const partnerInfo = await PartnerInformation.create({
        accountId: account._id,
        operatorName,
        operatorPhone: operatorPhone || phone,
        taxCode,
        description: description || '',
        amenities: amenities || [],
        policies: policies || {},
        profilePicture: profilePicture || null,
        coverImage: coverImage || null,
        businessLicense: businessLicense || null,
        licenseStatus: 'PENDING',
        selectedPlanId: plan._id,
        isVerified: false,
        verifiedAt: null
    });

    // 7. Send pending approval email
    const emailService = require('./email.service');
    emailService.sendPartnerPendingApprovalEmail(account.email, partnerInfo.operatorName)
        .then(() => console.log(`[Registration] Pending approval email sent to ${account.email}`))
        .catch((err) => console.error(`[Registration] Error sending pending approval email:`, err));

    return {
        account: {
            _id: account._id,
            email: account.email,
            phone: account.phone,
            fullName: account.fullName,
            role: account.role,
            status: account.status
        },
        partnerInfo: {
            _id: partnerInfo._id,
            operatorName: partnerInfo.operatorName,
            taxCode: partnerInfo.taxCode,
            licenseStatus: partnerInfo.licenseStatus
        }
    };
};

/**
 * Continue operator registration - verify identity and return current status
 * @param {string} email
 * @param {string} password
 * @returns {object} { status, licenseStatus, rejectionReason, account, partnerInfo }
 */
const continueOperatorRegistration = async (email, password) => {
    const PartnerInformation = require('../models/PartnerInformation');

    if (!email || !password) {
        throw new AppError('Email and password are required', 400);
    }

    // 1. Find account with PENDING_APPROVAL status
    const account = await Account.findOne({
        email: email.toLowerCase(),
        role: 'PARTNER',
        status: 'PENDING_APPROVAL',
        deletedAt: null
    }).select('+passwordHash');

    if (!account) {
        throw new AppError('No pending registration found for this email', 404);
    }

    // 2. Verify password
    if (!account.passwordHash) {
        throw new AppError('Account does not have a password set', 400);
    }

    const isMatch = await bcrypt.compare(password, account.passwordHash);
    if (!isMatch) {
        throw new AppError('Incorrect password', 401);
    }

    // 3. Get partner information
    const partnerInfo = await PartnerInformation.findOne({ accountId: account._id });
    if (!partnerInfo) {
        throw new AppError('Partner information not found', 404);
    }

    return {
        accountStatus: account.status,
        licenseStatus: partnerInfo.licenseStatus,
        rejectionReason: partnerInfo.rejectionReason || null,
        account: {
            _id: account._id,
            email: account.email,
            phone: account.phone,
            fullName: account.fullName
        },
        partnerInfo: {
            _id: partnerInfo._id,
            operatorName: partnerInfo.operatorName,
            businessLicense: partnerInfo.businessLicense,
            selectedPlanId: partnerInfo.selectedPlanId
        }
    };
};

/**
 * Phase 2: Complete operator payment (after license approved)
 * Receives SePay/bank config → creates Transaction with QR code
 * @param {object} data - { email, password, bankName, bankNumber, bankAccountName, bankBranch, sepayVa, sepayKey }
 * @returns {object} { transaction }
 */
const completeOperatorPayment = async (data) => {
    const SubscriptionPlan = require('../models/SubscriptionPlan');
    const Transaction = require('../models/Transaction');
    const PartnerInformation = require('../models/PartnerInformation');
    const sepayCrypto = require('../utils/sepayCrypto');

    const {
        email, password,
        bankName, bankNumber, bankAccountName, bankBranch,
        sepayVa, sepayKey
    } = data;

    // 1. Verify identity
    const account = await Account.findOne({
        email: email.toLowerCase(),
        role: 'PARTNER',
        status: 'PENDING_APPROVAL',
        deletedAt: null
    }).select('+passwordHash');

    if (!account) {
        throw new AppError('No pending registration found for this email', 404);
    }

    const isMatch = await bcrypt.compare(password, account.passwordHash);
    if (!isMatch) {
        throw new AppError('Incorrect password', 401);
    }

    // 2. Check license is approved
    const partnerInfo = await PartnerInformation.findOne({ accountId: account._id });
    if (!partnerInfo) {
        throw new AppError('Partner information not found', 404);
    }

    if (partnerInfo.licenseStatus !== 'APPROVED') {
        throw new AppError('Business license has not been approved yet', 403);
    }

    // 3. Validate sepayVa uniqueness
    const existingPartnerInfo = await PartnerInformation.findOne({
        sepayVa,
        _id: { $ne: partnerInfo._id }
    });
    if (existingPartnerInfo) {
        const associatedAccount = await Account.findOne({ _id: existingPartnerInfo.accountId, deletedAt: null });
        if (associatedAccount) {
            throw new AppError('This SePay Virtual Account (VA) is already registered by another partner', 409);
        }
    }

    // 4. Update PartnerInformation with bank/SePay details
    partnerInfo.bankName = bankName;
    partnerInfo.bankNumber = bankNumber;
    partnerInfo.bankAccountName = bankAccountName;
    partnerInfo.bankBranch = bankBranch || '';
    partnerInfo.sepayVa = sepayVa;
    partnerInfo.sepayKeyEncrypted = sepayKey;
    await partnerInfo.save();

    // 5. Get plan and calculate amount
    const plan = await SubscriptionPlan.findOne({ _id: partnerInfo.selectedPlanId, status: 'ACTIVE' });
    if (!plan) {
        throw new AppError('Selected subscription plan is no longer available', 404);
    }

    const amount = Math.round(plan.price - (plan.price * plan.discount / 100));

    // 6. Create Transaction
    const transaction = await Transaction.create({
        partnerId: account._id,
        subscriptionId: null,
        transactionType: 'SUBSCRIPTION_PAYMENT',
        amount,
        currency: 'VND',
        status: 'PENDING',
        gateway: 'SEPAY',
        description: `Subscription package payment`,
        metadata: {
            planId: plan._id
        }
    });

    // Generate reference code
    transaction.code = `BUSNET_SUB_${transaction._id}`;
    transaction.content = `BUSNET SUB ${transaction._id}`;
    await transaction.save();

    // 7. Prepare VietQR payment QR URL
    const adminVa = process.env.ADMIN_SEPAY_VA || '7411208853';
    const adminBank = process.env.ADMIN_SEPAY_BANK || 'BIDV';
    const qrUrl = `https://qr.sepay.vn/img?acc=${adminVa}&bank=${adminBank}&amount=${transaction.amount}&des=${transaction.content}`;

    return {
        transaction: {
            _id: transaction._id,
            amount: transaction.amount,
            content: transaction.content,
            status: transaction.status,
            qrUrl,
            adminBank,
            adminVa
        }
    };
};

/**
 * Resubmit business license after rejection
 * @param {object} data - { email, password, businessLicense }
 * @returns {object} { partnerInfo }
 */
const resubmitLicense = async (data) => {
    const PartnerInformation = require('../models/PartnerInformation');

    const { email, password, businessLicense } = data;

    if (!email || !password || !businessLicense) {
        throw new AppError('Email, password and business license are required', 400);
    }

    // 1. Verify identity
    const account = await Account.findOne({
        email: email.toLowerCase(),
        role: 'PARTNER',
        status: 'PENDING_APPROVAL',
        deletedAt: null
    }).select('+passwordHash');

    if (!account) {
        throw new AppError('No pending registration found for this email', 404);
    }

    const isMatch = await bcrypt.compare(password, account.passwordHash);
    if (!isMatch) {
        throw new AppError('Incorrect password', 401);
    }

    // 2. Get partner information
    const partnerInfo = await PartnerInformation.findOne({ accountId: account._id });
    if (!partnerInfo) {
        throw new AppError('Partner information not found', 404);
    }

    if (partnerInfo.licenseStatus !== 'REJECTED') {
        throw new AppError('License can only be resubmitted after rejection', 400);
    }

    // 3. Update license and reset status to PENDING
    partnerInfo.businessLicense = businessLicense;
    partnerInfo.licenseStatus = 'PENDING';
    partnerInfo.rejectionReason = null;
    partnerInfo.reviewedBy = null;
    partnerInfo.reviewedAt = null;
    await partnerInfo.save();

    // 4. Send pending approval email
    const emailService = require('./email.service');
    emailService.sendPartnerPendingApprovalEmail(account.email, partnerInfo.operatorName)
        .then(() => console.log(`[Registration] Re-submission pending approval email sent to ${account.email}`))
        .catch((err) => console.error(`[Registration] Error sending pending approval email:`, err));

    return {
        partnerInfo: {
            _id: partnerInfo._id,
            operatorName: partnerInfo.operatorName,
            businessLicense: partnerInfo.businessLicense,
            licenseStatus: partnerInfo.licenseStatus
        }
    };
};

/**
 * Send OTP for partner email verification
 */
const sendPartnerVerificationOTP = async (email) => {
    if (!email) {
        throw new AppError('Email is required', 400);
    }
    
    // Check if email already registered as a non-deleted account
    const existing = await Account.findOne({ email: email.toLowerCase(), deletedAt: null });
    if (existing) {
        throw new AppError('This email is already registered', 409);
    }

    // Generate 6-digit OTP
    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_SALT_ROUNDS);
    const expiredAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete existing verification codes for this email and type VERIFY_EMAIL
    await CodeVerification.deleteMany({ target: email.toLowerCase(), targetType: 'EMAIL', type: 'VERIFY_EMAIL' });

    await CodeVerification.create({
        accountId: null,
        target: email.toLowerCase(),
        targetType: 'EMAIL',
        type: 'VERIFY_EMAIL',
        codeHash,
        expiredAt
    });

    // Send email
    await emailService.sendVerificationEmail(email.toLowerCase(), code);
    
    return { success: true, message: 'Verification code sent', ...(process.env.NODE_ENV === 'development' ? { code } : {}) };
};

/**
 * Verify OTP for partner email verification
 */
const verifyPartnerOTP = async (email, code) => {
    if (!email || !code) {
        throw new AppError('Email and verification code are required', 400);
    }

    const verification = await CodeVerification.findOne({
        target: email.toLowerCase(),
        targetType: 'EMAIL',
        type: 'VERIFY_EMAIL',
        used: false,
        expiredAt: { $gt: new Date() }
    }).select('+codeHash');

    if (!verification) {
        throw new AppError('Invalid or expired verification code', 400);
    }

    if (verification.attemptCount >= verification.maxAttempts) {
        throw new AppError('Too many failed attempts. Please request a new code.', 400);
    }

    const isMatch = await bcrypt.compare(code, verification.codeHash);
    if (!isMatch) {
        verification.attemptCount += 1;
        await verification.save();
        throw new AppError('Incorrect verification code', 400);
    }

    verification.used = true;
    verification.usedAt = new Date();
    await verification.save();

    return { success: true, message: 'Email verified successfully' };
};

// ============================
// ADMIN: LOGIN
// ============================

const loginAdmin = async ({ email, password }) => {
    if (!email || !password) {
        throw new Error('Please enter email and password');
    }

    const admin = await Account.findOne({
        email: email.toLowerCase(),
        role: 'ADMIN'
    }).select('+passwordHash');

    if (!admin) {
        throw new Error('Incorrect account or password');
    }

    if (admin.status !== 'ACTIVE') {
        throw new Error('This account has been disabled');
    }

    if (admin.emailVerifyLockedUntil && admin.emailVerifyLockedUntil > new Date()) {
        throw new Error(formatLockError(admin.emailVerifyLockedUntil));
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);

    if (!isMatch) {
        throw new Error('Incorrect account or password');
    }

    // Admin has hit the lockout at least once before and still hasn't verified
    // their email: require a fresh email-code confirmation before restoring
    // full access, instead of logging straight in. verifyLoginCodeAdmin()
    // completes the login once the code is confirmed.
    if (admin.emailVerifyLockStrikes > 0 && !admin.isEmailVerified) {
        await sendAdminVerificationCode(admin);
        return {
            requiresVerification: true,
            email: admin.email,
            message: 'For your security, we sent a verification code to your email. Enter it to confirm your identity and finish logging in.'
        };
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = generateToken({ accountId: admin._id, role: admin.role });

    return {
        token,
        admin: buildAdminAuthPayload(admin)
    };
};

// ============================
// ADMIN: VERIFY EMAIL
// ============================

const ADMIN_VERIFY_RESEND_COOLDOWN_SECONDS = 60;
const ADMIN_VERIFY_LOCK_BASE_DAYS = 7;

const formatLockError = (lockedUntil) => {
    const daysLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return `Account is temporarily locked due to repeated failed verification attempts. Try again in ${daysLeft} day(s) (until ${lockedUntil.toISOString()}).`;
};

const assertAdminNotLocked = (admin) => {
    if (admin.emailVerifyLockedUntil && admin.emailVerifyLockedUntil > new Date()) {
        throw new Error(formatLockError(admin.emailVerifyLockedUntil));
    }
};

// Shared by the Settings "verify email" flow and the post-lockout login
// confirmation flow — both just need a fresh code emailed to the admin.
const sendAdminVerificationCode = async (admin) => {
    const lastCode = await CodeVerification.findOne({
        target: admin.email,
        targetType: 'EMAIL',
        type: CODE_VERIFICATION_TYPE.VERIFY_EMAIL
    }).sort({ createdAt: -1 });

    if (lastCode) {
        const secondsSinceLastSend = (Date.now() - lastCode.createdAt.getTime()) / 1000;
        if (secondsSinceLastSend < ADMIN_VERIFY_RESEND_COOLDOWN_SECONDS) {
            const waitSeconds = Math.ceil(ADMIN_VERIFY_RESEND_COOLDOWN_SECONDS - secondsSinceLastSend);
            throw new Error(`Please wait ${waitSeconds}s before requesting a new code`);
        }
    }

    // Invalidate any still-valid earlier code so only the latest one can succeed.
    await CodeVerification.deleteMany({
        target: admin.email,
        targetType: 'EMAIL',
        type: CODE_VERIFICATION_TYPE.VERIFY_EMAIL
    });

    const code = generateVerificationCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_SALT_ROUNDS);

    await CodeVerification.create({
        accountId: admin._id,
        target: admin.email,
        targetType: 'EMAIL',
        type: CODE_VERIFICATION_TYPE.VERIFY_EMAIL,
        codeHash,
        expiredAt: addMinutes(new Date(), 10)
    });

    await emailService.sendAdminVerificationEmail(admin.email, code);
};

const sendVerifyEmailAdmin = async (adminId) => {
    const admin = await Account.findOne({ _id: adminId, role: 'ADMIN' });

    if (!admin) {
        throw new Error('Admin not found');
    }

    if (admin.isEmailVerified) {
        throw new Error('Email has already been verified');
    }

    assertAdminNotLocked(admin);
    await sendAdminVerificationCode(admin);

    return {
        message: 'Verification code has been sent to your email',
        expiresInSeconds: 600,
        resendCooldownSeconds: ADMIN_VERIFY_RESEND_COOLDOWN_SECONDS
    };
};

// Shared by verifyEmailAdmin (Settings flow) and verifyLoginCodeAdmin
// (post-lockout login flow): on a wrong code, count the attempt and, once
// attempts are exhausted, escalate the progressive lockout.
const registerFailedAdminCodeAttempt = async (admin, record) => {
    record.attemptCount += 1;
    await record.save();
    const remainingAttempts = record.maxAttempts - record.attemptCount;

    if (remainingAttempts <= 0) {
        // Each time this triggers, the lock duration doubles from the
        // previous one (7 days, 14, 28, 56, ...).
        admin.emailVerifyLockStrikes += 1;
        const lockDays = ADMIN_VERIFY_LOCK_BASE_DAYS * (2 ** (admin.emailVerifyLockStrikes - 1));
        admin.emailVerifyLockedUntil = new Date(Date.now() + lockDays * 24 * 60 * 60 * 1000);
        await admin.save();
        throw new Error(formatLockError(admin.emailVerifyLockedUntil));
    }

    throw new Error(`Invalid verification code. ${remainingAttempts} attempt(s) remaining`);
};

const findActiveAdminCode = async (admin) => {
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

    return record;
};

const buildAdminAuthPayload = (admin) => ({
    _id: admin._id,
    username: admin.username,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    status: admin.status,
    avatar: admin.profilePicture,
    lastLoginAt: admin.lastLoginAt
});

const verifyEmailAdmin = async (adminId, code) => {
    const admin = await Account.findOne({ _id: adminId, role: 'ADMIN' });

    if (!admin) {
        throw new Error('Admin not found');
    }

    if (admin.isEmailVerified) {
        throw new Error('Email has already been verified');
    }

    assertAdminNotLocked(admin);

    const record = await findActiveAdminCode(admin);
    const isMatch = await bcrypt.compare(code, record.codeHash);

    if (!isMatch) {
        await registerFailedAdminCodeAttempt(admin, record);
    }

    record.used = true;
    record.usedAt = new Date();
    await record.save();

    admin.emailVerifyLockStrikes = 0;
    admin.emailVerifyLockedUntil = null;

    admin.isEmailVerified = true;
    await admin.save();

    return { message: 'Email verified successfully' };
};

// Completes the login that loginAdmin() deferred because the admin had a
// prior lockout strike and still hadn't verified their email — confirming
// this code both finishes login (issues a token) and verifies the email in
// the same step, so there's no separate Settings trip needed afterward.
const verifyLoginCodeAdmin = async (email, code) => {
    const admin = await Account.findOne({ email: email.toLowerCase(), role: 'ADMIN' });

    if (!admin) {
        throw new Error('Admin not found');
    }

    if (admin.status !== 'ACTIVE') {
        throw new Error('This account has been disabled');
    }

    assertAdminNotLocked(admin);

    const record = await findActiveAdminCode(admin);
    const isMatch = await bcrypt.compare(code, record.codeHash);

    if (!isMatch) {
        await registerFailedAdminCodeAttempt(admin, record);
    }

    record.used = true;
    record.usedAt = new Date();
    await record.save();

    admin.emailVerifyLockStrikes = 0;
    admin.emailVerifyLockedUntil = null;
    admin.isEmailVerified = true;
    admin.lastLoginAt = new Date();
    await admin.save();

    const token = generateToken({ accountId: admin._id, role: admin.role });

    return { token, admin: buildAdminAuthPayload(admin) };
};

// ============================
// ADMIN: FORGOT / RESET PASSWORD
// ============================

const forgotPasswordAdmin = async (email) => {
    if (!email) {
        throw new Error('Please enter your email');
    }

    const admin = await Account.findOne({ email: email.toLowerCase(), role: 'ADMIN' });

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

    const admin = await Account.findOne({ email: email.toLowerCase(), role: 'ADMIN' });

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

// ============================
// PARTNER: FORGOT / RESET PASSWORD
// ============================

/**
 * Send password reset code for partner
 * @param {string} email
 */
const forgotPasswordPartner = async (email) => {
    if (!email) {
        throw new AppError('Email is required', 400);
    }

    const account = await Account.findOne({
        email: email.toLowerCase(),
        role: 'PARTNER',
        deletedAt: null
    });

    if (!account) {
        throw new AppError('Partner account with this email does not exist', 404);
    }

    if (account.status === 'BANNED' || account.status === 'DELETED') {
        throw new AppError('This account is suspended or deleted', 403);
    }

    // Generate 6-digit OTP code
    const verificationCode = generateVerificationCode();
    const codeHash = await bcrypt.hash(verificationCode, BCRYPT_SALT_ROUNDS);
    const expiredAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store in CodeVerification
    await CodeVerification.create({
        accountId: account._id,
        target: email.toLowerCase(),
        targetType: 'EMAIL',
        type: 'RESET_PASSWORD',
        codeHash,
        expiredAt
    });

    // Send email
    emailService.sendPasswordResetEmail(email.toLowerCase(), verificationCode)
        .catch(err => console.error('Failed to send password reset email:', err));

    return { message: 'Password reset code has been sent to your email' };
};

/**
 * Verify reset code for partner
 * @param {string} email
 * @param {string} code
 * @returns {Promise<boolean>}
 */
const verifyResetCodePartner = async (email, code) => {
    if (!email || !code) {
        throw new AppError('Email and code are required', 400);
    }

    const account = await Account.findOne({
        email: email.toLowerCase(),
        role: 'PARTNER',
        deletedAt: null
    });

    if (!account) {
        throw new AppError('Partner account with this email does not exist', 404);
    }

    const verification = await CodeVerification.findOne({
        accountId: account._id,
        target: email.toLowerCase(),
        targetType: 'EMAIL',
        type: 'RESET_PASSWORD',
        used: false,
        expiredAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).select('+codeHash');

    if (!verification) {
        throw new AppError('Invalid or expired verification code', 400);
    }

    if (verification.attemptCount >= verification.maxAttempts) {
        throw new AppError('Too many failed attempts. Please request a new code', 400);
    }

    const isMatch = await bcrypt.compare(code, verification.codeHash);
    if (!isMatch) {
        verification.attemptCount += 1;
        await verification.save();
        const remainingAttempts = verification.maxAttempts - verification.attemptCount;
        throw new AppError(`Incorrect code. ${remainingAttempts} attempts remaining`, 400);
    }

    return true;
};

/**
 * Reset password for partner using verification code
 * @param {string} email
 * @param {string} code
 * @param {string} newPassword
 */
const resetPasswordPartner = async (email, code, newPassword) => {
    if (!email || !code || !newPassword) {
        throw new AppError('Email, code, and new password are required', 400);
    }

    if (newPassword.length < 6) {
        throw new AppError('Password must be at least 6 characters', 400);
    }

    const account = await Account.findOne({
        email: email.toLowerCase(),
        role: 'PARTNER',
        deletedAt: null
    });

    if (!account) {
        throw new AppError('Partner account not found', 404);
    }

    // 1. Find verification code
    const verification = await CodeVerification.findOne({
        accountId: account._id,
        target: email.toLowerCase(),
        targetType: 'EMAIL',
        type: 'RESET_PASSWORD',
        used: false,
        expiredAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).select('+codeHash');

    if (!verification) {
        throw new AppError('Invalid or expired verification code', 400);
    }

    if (verification.attemptCount >= verification.maxAttempts) {
        throw new AppError('Too many failed attempts. Please request a new code', 400);
    }

    // 2. Verify code
    const isMatch = await bcrypt.compare(code, verification.codeHash);
    if (!isMatch) {
        verification.attemptCount += 1;
        await verification.save();
        const remainingAttempts = verification.maxAttempts - verification.attemptCount;
        throw new AppError(`Incorrect code. ${remainingAttempts} attempts remaining`, 400);
    }

    // 3. Hash new password
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // 4. Update account password
    const updatedAccount = await Account.findOneAndUpdate(
        { _id: account._id, role: 'PARTNER', deletedAt: null },
        { passwordHash },
        { returnDocument: 'after' }
    );

    if (!updatedAccount) {
        throw new AppError('Partner account not found', 404);
    }

    // 5. Mark code as used
    verification.used = true;
    verification.usedAt = new Date();
    await verification.save();

    return { message: 'Password has been reset successfully' };
};

/**
 * Resend password reset code for partner
 * @param {string} email
 */
const resendResetCodePartner = async (email) => {
    if (!email) {
        throw new AppError('Email is required', 400);
    }

    // Delete old reset codes
    await CodeVerification.deleteMany({
        target: email.toLowerCase(),
        targetType: 'EMAIL',
        type: 'RESET_PASSWORD',
        used: false
    });

    // Send new reset code
    return await forgotPasswordPartner(email);
};

module.exports = {
    registerCustomer,
    loginCustomer,
    loginGoogleCustomer,
    verifyEmail,
    forgotPassword,
    verifyResetCode,
    resetPassword,
    submitOperatorRegistration,
    continueOperatorRegistration,
    completeOperatorPayment,
    resubmitLicense,
    sendPartnerVerificationOTP,
    verifyPartnerOTP,
    loginPartner,
    loginAdmin,
    sendVerifyEmailAdmin,
    verifyEmailAdmin,
    verifyLoginCodeAdmin,
    forgotPasswordAdmin,
    resetPasswordAdmin,
    forgotPasswordPartner,
    verifyResetCodePartner,
    resetPasswordPartner,
    resendResetCodePartner
};
