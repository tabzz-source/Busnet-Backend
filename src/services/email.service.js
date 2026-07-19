const nodemailer = require('nodemailer');

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for 587 (STARTTLS)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    family: 4 // Force IPv4 to prevent IPv6 loopback (::1) resolution issues
});

// Verify connection configuration on startup (disabled to keep console quiet during local sandbox testing)
// transporter.verify((error, success) => {
//     if (error) {
//         console.error(`SMTP Connection Error (Host: ${process.env.EMAIL_HOST}, Port: ${process.env.EMAIL_PORT}):`, error);
//     } else {
//         console.log('SMTP Server is ready to take our messages');
//     }
// });

/**
 * Send Email Verification Code (OTP)
 * @param {string} email - Destination email
 * @param {string} code - 6-digit verification code
 */
const sendVerificationEmail = async (email, code) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM || '"BusNet" <no-reply@busnet.com>',
        to: email,
        subject: '[BusNet] Verify Your Email Address',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
                <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 20px;">
                    <h1 style="color: #1e3a8a; margin: 0; font-size: 28px; letter-spacing: 1px;">BusNet</h1>
                    <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Your Premium Bus Transportation Network</p>
                </div>
                <div style="padding: 10px 20px;">
                    <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Welcome to BusNet!</h2>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Thank you for registering. To activate your account, please verify your email address by entering the 6-digit OTP code below:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="display: inline-block; font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #3b82f6; background-color: #eff6ff; padding: 15px 30px; border: 1px dashed #3b82f6; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1);">
                            ${code}
                        </span>
                    </div>
                    <p style="color: #ef4444; font-size: 14px; font-weight: 500; margin-bottom: 25px;">
                        * This verification code is valid for <strong>10 minutes</strong>. Please do not share this code with anyone.
                    </p>
                    <p style="color: #334155; line-height: 1.6; font-size: 15px;">
                        If you did not request this, you can safely ignore this email.
                    </p>
                </div>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
                    <p style="margin: 0 0 5px 0;">&copy; ${new Date().getFullYear()} BusNet Project. All rights reserved.</p>
                    <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
                </div>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

/**
 * Send Email Verification Code (OTP) for an Admin's own account settings.
 * Distinct copy from sendVerificationEmail — that one is customer-registration
 * flavored ("Welcome to BusNet! Thank you for registering...") which doesn't
 * fit an existing admin verifying their own email from Settings.
 * @param {string} email - Destination email
 * @param {string} code - 6-digit verification code
 */
const sendAdminVerificationEmail = async (email, code) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM || '"BusNet" <no-reply@busnet.com>',
        to: email,
        subject: '[BusNet] Verify Your Admin Account Email',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
                <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 20px;">
                    <h1 style="color: #1e3a8a; margin: 0; font-size: 28px; letter-spacing: 1px;">BusNet</h1>
                    <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Admin Console</p>
                </div>
                <div style="padding: 10px 20px;">
                    <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Confirm Your Email Address</h2>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        You requested to verify the email address on your BusNet Admin Console account. Enter the 6-digit code below to confirm it's you:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="display: inline-block; font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #3b82f6; background-color: #eff6ff; padding: 15px 30px; border: 1px dashed #3b82f6; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1);">
                            ${code}
                        </span>
                    </div>
                    <p style="color: #ef4444; font-size: 14px; font-weight: 500; margin-bottom: 25px;">
                        * This verification code is valid for <strong>10 minutes</strong>. Please do not share this code with anyone.
                    </p>
                    <p style="color: #334155; line-height: 1.6; font-size: 15px;">
                        If you did not request this, you can safely ignore this email — your account remains secure.
                    </p>
                </div>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
                    <p style="margin: 0 0 5px 0;">&copy; ${new Date().getFullYear()} BusNet Project. All rights reserved.</p>
                    <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
                </div>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

/**
 * Send Password Reset Verification Code (OTP)
 * @param {string} email - Destination email
 * @param {string} code - 6-digit verification code
 */
const sendPasswordResetEmail = async (email, code) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM || '"BusNet" <no-reply@busnet.com>',
        to: email,
        subject: '[BusNet] Reset Your Password',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
                <div style="text-align: center; border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 20px;">
                    <h1 style="color: #1e3a8a; margin: 0; font-size: 28px; letter-spacing: 1px;">BusNet</h1>
                    <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Your Premium Bus Transportation Network</p>
                </div>
                <div style="padding: 10px 20px;">
                    <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Reset Your Password</h2>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        We received a request to reset your password. Please use the 6-digit verification code below to proceed with changing your password:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="display: inline-block; font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #f97316; background-color: #fff7ed; padding: 15px 30px; border: 1px dashed #f97316; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(249, 115, 22, 0.1);">
                            ${code}
                        </span>
                    </div>
                    <p style="color: #ef4444; font-size: 14px; font-weight: 500; margin-bottom: 25px;">
                        * This code is valid for <strong>10 minutes</strong>. If you did not make this request, someone else may be trying to access your account. Please check your security settings.
                    </p>
                </div>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
                    <p style="margin: 0 0 5px 0;">&copy; ${new Date().getFullYear()} BusNet Project. All rights reserved.</p>
                    <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
                </div>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

/**
 * Send Welcome Email to Partner after successful activation/payment
 * @param {string} email - Destination email
 * @param {string} operatorName - Partner operator name
 * @param {string} loginUrl - Partner dashboard login URL
 */
const sendPartnerWelcomeEmail = async (email, operatorName, loginUrl) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM || '"BusNet" <no-reply@busnet.com>',
        to: email,
        subject: '[BusNet] Congratulations! Your Bus Operator Account Has Been Activated',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 25px;">
                    <h1 style="color: #064e3b; margin: 0; font-size: 28px; letter-spacing: 1px; font-weight: 800;">BusNet</h1>
                    <p style="color: #047857; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">Smart Bus Operator Platform</p>
                </div>
                <div style="padding: 10px 10px;">
                    <h2 style="color: #0f172a; margin-top: 0; font-size: 22px; font-weight: 700; text-align: center;">Congratulations!</h2>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Dear <strong>${operatorName}</strong>,
                    </p>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Your partner account on the <strong>BusNet</strong> system has been successfully activated following the subscription payment verification.
                    </p>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        You can now sign in to your operator dashboard to manage your bus fleet, configure routes, sell tickets online, and track business revenue.
                    </p>
                    <div style="text-align: center; margin: 35px 0;">
                        <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 35px; font-size: 16px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3); transition: all 0.3s ease;">
                            SIGN IN TO OPERATOR DASHBOARD
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-top: 25px;">
                        If the button above does not work, copy and paste this link into your browser: <br/>
                        <a href="${loginUrl}" style="color: #10b981; word-break: break-all;">${loginUrl}</a>
                    </p>
                </div>
                <div style="margin-top: 35px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
                    <p style="margin: 0 0 5px 0;">&copy; ${new Date().getFullYear()} BusNet Project. All rights reserved.</p>
                    <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
                </div>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

/**
 * Send Booking Confirmation Email after successful payment
 * @param {object} params
 * @param {string} params.email - Recipient email
 * @param {string} params.customerName - Customer/passenger name
 * @param {string} params.bookingCode - Booking code
 * @param {string} params.tripCode - Trip code
 * @param {string|Date} params.departureDate - Departure date
 * @param {string|number} params.departureTime - Departure time or time label
 * @param {Array<string>} params.seatCodes - Seat codes
 * @param {number} params.total - Total amount
 * @param {string} [params.passengerPhone] - Passenger phone
 * @param {string} [params.pickupPoint] - Pickup point summary
 * @param {string} [params.dropoffPoint] - Dropoff point summary
 */
const sendBookingConfirmationEmail = async (params = {}) => {
    const {
        email,
        customerName = 'Customer',
        bookingCode,
        tripCode = 'N/A',
        departureDate,
        departureTime = null,
        seatCodes = [],
        total = 0,
        passengerPhone = '',
        pickupPoint = '',
        dropoffPoint = ''
    } = params;

    const formatDateTime = (value) => {
        if (!value) return 'N/A';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString('en-GB', {
            timeZone: 'Asia/Bangkok',
            hour12: false
        });
    };

    const safeSeatList = seatCodes.length > 0 ? seatCodes.join(', ') : 'N/A';
    const safeDeparture = departureTime !== null && departureTime !== undefined
        ? `${formatDateTime(departureDate)}${departureTime !== null ? ` (${departureTime})` : ''}`
        : formatDateTime(departureDate);

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"BusNet" <no-reply@busnet.com>',
        to: email,
        subject: `[BusNet] Booking confirmed - ${bookingCode || 'Your trip'}`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 14px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);">
                <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 18px; margin-bottom: 24px;">
                    <h1 style="color: #0f172a; margin: 0; font-size: 30px; letter-spacing: 1px;">BusNet</h1>
                    <p style="color: #64748b; margin: 6px 0 0 0; font-size: 14px;">Your booking has been confirmed successfully</p>
                </div>

                <div style="padding: 0 4px;">
                    <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 22px;">Hello ${customerName},</h2>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px; margin-top: 0;">
                        Your payment has been received and your booking is now confirmed. Below are your booking details.
                    </p>

                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 18px 20px; margin: 22px 0;">
                        <div style="font-size: 14px; color: #1d4ed8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">Booking Code</div>
                        <div style="font-family: monospace; font-size: 26px; font-weight: 700; color: #1e40af;">${bookingCode || 'N/A'}</div>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px;">
                        <tr>
                            <td style="padding: 10px 0; color: #64748b; width: 34%; vertical-align: top;">Trip Code</td>
                            <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${tripCode}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Departure</td>
                            <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${safeDeparture}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Seats</td>
                            <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${safeSeatList}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Total</td>
                            <td style="padding: 10px 0; color: #0f172a; font-weight: 700;">${Number(total || 0).toLocaleString('en-US')} VND</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Passenger</td>
                            <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${customerName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Phone</td>
                            <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${passengerPhone || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Pickup</td>
                            <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${pickupPoint || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #64748b; vertical-align: top;">Dropoff</td>
                            <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${dropoffPoint || 'N/A'}</td>
                        </tr>
                    </table>

                    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 16px 18px; color: #065f46; line-height: 1.6;">
                        Please keep this email for your reference when boarding. If you need to check your booking again, you can use your booking code in the BusNet app or website.
                    </div>
                </div>

                <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
                    <p style="margin: 0 0 5px 0;">&copy; ${new Date().getFullYear()} BusNet Project. All rights reserved.</p>
                    <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
                </div>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

/**
 * Send Pending Approval Email to Partner after successful payment
 * @param {string} email - Destination email
 * @param {string} operatorName - Partner operator name
 */
const sendPartnerPendingApprovalEmail = async (email, operatorName) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM || '"BusNet" <no-reply@busnet.com>',
        to: email,
        subject: '[BusNet] Payment Received - Account Verification Pending',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <div style="text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 20px; margin-bottom: 25px;">
                    <h1 style="color: #78350f; margin: 0; font-size: 28px; letter-spacing: 1px; font-weight: 800;">BusNet</h1>
                    <p style="color: #b45309; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">Smart Bus Operator Platform</p>
                </div>
                <div style="padding: 10px 10px;">
                    <h2 style="color: #0f172a; margin-top: 0; font-size: 22px; font-weight: 700; text-align: center;">Subscription Payment Verified</h2>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Dear <strong>${operatorName}</strong>,
                    </p>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        We have successfully verified your subscription payment. Thank you for choosing BusNet!
                    </p>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Your account is currently in a <strong>Pending Approval</strong> state while our administrative team reviews your uploaded Business License. This verification process typically takes up to 24 hours.
                    </p>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Once approved, you will receive a confirmation email indicating that your account has been fully activated, and you will be able to log in and start configuring your workspace.
                    </p>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        If you have any questions or need to provide additional details, please reply directly to this email or contact our support team.
                    </p>
                </div>
                <div style="margin-top: 35px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
                    <p style="margin: 0 0 5px 0;">&copy; ${new Date().getFullYear()} BusNet Project. All rights reserved.</p>
                    <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
                </div>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

/**
 * Send License Approved Email to Partner
 * @param {string} email - Destination email
 * @param {string} operatorName - Partner operator name
 */
const sendLicenseApprovedEmail = async (email, operatorName) => {
    const registerUrl = process.env.CUSTOMER_WEB_URL
        ? `${process.env.CUSTOMER_WEB_URL}/register-operator`
        : 'http://localhost:5174/register-operator';

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"BusNet" <no-reply@busnet.com>',
        to: email,
        subject: '[BusNet] Business License Approved - Complete Your Registration',
         <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 25px;">
                    <h1 style="color: #064e3b; margin: 0; font-size: 28px; letter-spacing: 1px; font-weight: 800;">BusNet</h1>
                    <p style="color: #047857; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">Smart Bus Operator Platform</p>
                </div>
                <div style="padding: 10px 10px;">
                    <h2 style="color: #0f172a; margin-top: 0; font-size: 22px; font-weight: 700; text-align: center;">Business License Approved! ✅</h2>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Dear <strong>${operatorName}</strong>,
                    </p>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Great news! Your business license has been reviewed and <strong style="color: #10b981;">approved</strong> by our administrative team.
                    </p>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        You can now continue your registration by completing the payment setup. Please visit the registration page and use the <strong>"Continue Registration"</strong> option with your registered email.
                    </p>
                    <div style="text-align: center; margin: 35px 0;">
                        <a href="${registerUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 35px; font-size: 16px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">
                            CONTINUE REGISTRATION
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-top: 25px;">
                        If the button above does not work, copy and paste this link into your browser: <br/>
                        <a href="${registerUrl}" style="color: #10b981; word-break: break-all;">${registerUrl}</a>
                    </p>
                </div>
                <div style="margin-top: 35px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
                    <p style="margin: 0 0 5px 0;">&copy; ${new Date().getFullYear()} BusNet Project. All rights reserved.</p>
                    <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
                </div>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

/**
 * Send License Rejected Email to Partner
 * @param {string} email - Destination email
 * @param {string} operatorName - Partner operator name
 * @param {string} rejectionReason - Reason for rejection
 */
const sendLicenseRejectedEmail = async (email, operatorName, rejectionReason) => {
    const registerUrl = process.env.CUSTOMER_WEB_URL
        ? `${process.env.CUSTOMER_WEB_URL}/register-operator`
        : 'http://localhost:5174/register-operator';

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"BusNet" <no-reply@busnet.com>',
        to: email,
        subject: '[BusNet] Business License Review - Action Required',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <div style="text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 20px; margin-bottom: 25px;">
                    <h1 style="color: #7f1d1d; margin: 0; font-size: 28px; letter-spacing: 1px; font-weight: 800;">BusNet</h1>
                    <p style="color: #dc2626; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">Smart Bus Operator Platform</p>
                </div>
                <div style="padding: 10px 10px;">
                    <h2 style="color: #0f172a; margin-top: 0; font-size: 22px; font-weight: 700; text-align: center;">Business License Not Approved</h2>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Dear <strong>${operatorName}</strong>,
                    </p>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Unfortunately, your business license could not be approved at this time. Our administrative team has provided the following reason:
                    </p>
                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px 20px; margin: 20px 0;">
                        <p style="color: #991b1b; font-size: 15px; font-weight: 600; margin: 0;">
                            📋 Reason: ${rejectionReason}
                        </p>
                    </div>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        You can resubmit your business license by visiting the registration page and using the <strong>"Continue Registration"</strong> option with your registered email.
                    </p>
                    <div style="text-align: center; margin: 35px 0;">
                        <a href="${registerUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 14px 35px; font-size: 16px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 10px rgba(249, 115, 22, 0.3);">
                            RESUBMIT LICENSE
                        </a>
                    </div>
                </div>
                <div style="margin-top: 35px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
                    <p style="margin: 0 0 5px 0;">&copy; ${new Date().getFullYear()} BusNet Project. All rights reserved.</p>
                    <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
                </div>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

// New email functions for blog approval/rejection
/**
 * Send Email to Partner when their blog is approved and published.
 * @param {string} email - Partner email address
 * @param {string} blogTitle - Title of the approved blog
 */
const sendBlogApprovedEmail = async (email, blogTitle) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM || "BusNet <no-reply@busnet.com>",
        to: email,
        subject: `[BusNet] Your blog "${blogTitle}" has been approved!`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                <h2 style="color: #064e3b; margin: 0 0 15px; font-size: 24px;">Blog Approved 🎉</h2>
                <p>Hello,</p>
                <p>Your blog post <strong>${blogTitle}</strong> has been reviewed and approved by the admin team. It is now live on the platform.</p>
                <p>Thank you for contributing to BusNet!</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;"/>
                <p style="font-size: 12px; color: #64748b;">This is an automated email, please do not reply.</p>
            </div>
        `
    };
    return transporter.sendMail(mailOptions);
};

/**
 * Send Email to Partner when their blog is rejected.
 * @param {string} email - Partner email address
 * @param {string} blogTitle - Title of the rejected blog
 * @param {string} reason - Reason for rejection
 */
const sendBlogRejectedEmail = async (email, blogTitle, reason) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM || "BusNet <no-reply@busnet.com>",
        to: email,
        subject: `[BusNet] Your blog "${blogTitle}" was rejected`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #fff7f7;">
                <h2 style="color: #7f1d1d; margin: 0 0 15px; font-size: 24px;">Blog Rejected ❌</h2>
                <p>Hello,</p>
                <p>Unfortunately, your blog post <strong>${blogTitle}</strong> did not meet our publishing guidelines.</p>
                <p><strong>Reason:</strong> ${reason || 'Not provided'}</p>
                <p>Please edit your post and resubmit for review.</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;"/>
                <p style="font-size: 12px; color: #64748b;">This is an automated email, please do not reply.</p>
            </div>
        `
    };
    return transporter.sendMail(mailOptions);
};


/**
 * Send Report Resolved Email to the customer who filed the report.
 * @param {string} email - Reporter email
 * @param {string} customerName - Reporter display name
 * @param {string} reportReason - Original report description
 * @param {string} [adminNote] - Admin's response/resolution note
 */
const sendReportResolvedEmail = async (email, customerName, reportReason, adminNote) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM || '"BusNet" <no-reply@busnet.com>',
        to: email,
        subject: '[BusNet] Your report has been resolved',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 25px;">
                    <h1 style="color: #064e3b; margin: 0; font-size: 28px; letter-spacing: 1px; font-weight: 800;">BusNet</h1>
                    <p style="color: #047857; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">Your Premium Bus Transportation Network</p>
                </div>
                <div style="padding: 10px 10px;">
                    <h2 style="color: #0f172a; margin-top: 0; font-size: 22px; font-weight: 700; text-align: center;">Your Report Has Been Resolved ✅</h2>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Dear <strong>${customerName || 'Customer'}</strong>,
                    </p>
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        Thank you for bringing this to our attention. Our support team has reviewed and resolved the report you submitted:
                    </p>
                    <div style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px 20px; margin: 20px 0;">
                        <p style="color: #475569; font-size: 14px; font-weight: 600; margin: 0 0 6px 0;">Your report:</p>
                        <p style="color: #334155; font-size: 15px; margin: 0;">${reportReason || 'N/A'}</p>
                    </div>
                    ${adminNote ? `
                    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 15px 20px; margin: 20px 0;">
                        <p style="color: #065f46; font-size: 14px; font-weight: 600; margin: 0 0 6px 0;">Our response:</p>
                        <p style="color: #065f46; font-size: 15px; margin: 0;">${adminNote}</p>
                    </div>
                    ` : ''}
                    <p style="color: #334155; line-height: 1.6; font-size: 16px;">
                        If you have any further questions, feel free to submit a new report or contact our support team.
                    </p>
                </div>
                <div style="margin-top: 35px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
                    <p style="margin: 0 0 5px 0;">&copy; ${new Date().getFullYear()} BusNet Project. All rights reserved.</p>
                    <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
                </div>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};

module.exports = {
    sendVerificationEmail,
    sendAdminVerificationEmail,
    sendPasswordResetEmail,
    sendPartnerWelcomeEmail,
    sendBookingConfirmationEmail,
    sendPartnerPendingApprovalEmail,
    sendLicenseApprovedEmail,
    sendLicenseRejectedEmail,
    sendBlogApprovedEmail,
    sendBlogRejectedEmail,
    sendReportResolvedEmail
};

