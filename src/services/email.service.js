const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendEmail = async ({ to, subject, html }) => {
    await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html
    });
};

const sendVerificationEmail = async (to, code) => {
    await sendEmail({
        to,
        subject: 'BusNet - Verify your email',
        html: `
            <p>Your email verification code is:</p>
            <h2>${code}</h2>
            <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        `
    });
};

const sendResetPasswordEmail = async (to, code) => {
    await sendEmail({
        to,
        subject: 'BusNet - Reset your password',
        html: `
            <p>Your password reset code is:</p>
            <h2>${code}</h2>
            <p>This code will expire in 15 minutes. If you did not request a password reset, please ignore this email.</p>
            <p>You can reset your password at: ${process.env.CLIENT_URL}</p>
        `
    });
};

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendResetPasswordEmail
};
