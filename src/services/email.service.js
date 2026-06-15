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

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail
};
