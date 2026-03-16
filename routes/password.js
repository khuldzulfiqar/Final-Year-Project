const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const nodemailer = require('nodemailer');

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// POST /api/password/forgot
router.post('/forgot', async (req, res) => {
  try {
    const User = require('../models/User');
    const { email } = req.body;

    console.log('🔑 Forgot password request for:', email);
    console.log('📧 EMAIL_USER:', process.env.EMAIL_USER);
    console.log('🔐 EMAIL_PASS loaded:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length + ' chars' : 'MISSING');

    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    console.log('👤 User found:', user ? user.fullName : 'NOT FOUND');

    if (!user) {
      // Don't reveal if email exists
      return res.json({ success: true, message: 'If this email is registered, a reset link has been sent.' });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();
    console.log('✅ Token saved to user');

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    console.log('🔗 Reset URL:', resetUrl);

    // Send email
    const transporter = createTransporter();
    const mailOptions = {
      from: `"MindBridge" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Reset Your MindBridge Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 20px;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                <tr><td style="background:linear-gradient(135deg,#0d7377,#14a085);padding:36px 40px;text-align:center;">
                  <h1 style="color:white;margin:0;font-size:26px;font-family:Georgia,serif;">MindBridge</h1>
                  <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Mental Health Platform</p>
                </td></tr>
                <tr><td style="padding:40px;">
                  <h2 style="color:#1a2e2e;margin:0 0 12px;font-size:22px;">Reset Your Password 🔐</h2>
                  <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 8px;">Hi <strong>${user.fullName}</strong>,</p>
                  <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 28px;">We received a request to reset your MindBridge password. Click the button below:</p>
                  <div style="text-align:center;margin-bottom:28px;">
                    <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#0d7377,#14a085);color:white;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:16px;font-weight:600;">Reset My Password</a>
                  </div>
                  <p style="color:#888;font-size:13px;margin:0 0 8px;">Or copy this link into your browser:</p>
                  <p style="background:#f5f8fa;border:1px solid #e0e7ef;border-radius:8px;padding:10px 14px;font-size:12px;color:#0d7377;word-break:break-all;margin:0 0 28px;">${resetUrl}</p>
                  <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:10px;padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:#856404;">⏰ <strong>This link expires in 1 hour.</strong> If you did not request this, ignore this email.</p>
                  </div>
                </td></tr>
                <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e8ecf0;">
                  <p style="color:#aaa;font-size:12px;margin:0;">© 2024 MindBridge</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Reset email sent to:', user.email);

    res.json({ success: true, message: 'If this email is registered, a reset link has been sent.' });

  } catch (err) {
    console.error('❌ Forgot password error:', err.message);
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to send email: ' + err.message });
  }
});

// GET /api/password/verify-token
router.get('/verify-token', async (req, res) => {
  try {
    const User = require('../models/User');
    const { token } = req.query;
    if (!token) return res.json({ success: false, message: 'Token is required' });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) return res.json({ success: false, message: 'Reset link is invalid or has expired.' });
    res.json({ success: true, email: user.email });
  } catch (err) {
    console.error('❌ Verify token error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/password/reset
router.post('/reset', async (req, res) => {
  try {
    const User = require('../models/User');
    const { token, password } = req.body;

    if (!token || !password) return res.status(400).json({ success: false, message: 'Token and password are required' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired.' });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.log('✅ Password reset for:', user.email);
    res.json({ success: true, message: 'Password reset successfully! You can now log in.' });

  } catch (err) {
    console.error('❌ Reset password error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
