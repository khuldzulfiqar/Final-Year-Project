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

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/password/forgot  — send OTP to email
router.post('/forgot', async (req, res) => {
  try {
    const User = require('../models/User');
    const { email } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Don't reveal if email exists or not
    if (!user) {
      return res.json({ success: true, message: 'If this email is registered, an OTP has been sent.' });
    }

    const otp = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetPasswordToken = otp;
    user.resetPasswordExpires = expires;
    await user.save();

    await createTransporter().sendMail({
      from: `"MindBridge" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Your MindBridge Password Reset OTP',
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="color:#0d7377;margin-bottom:8px;">Password Reset OTP</h2>
          <p style="color:#555;">Hi <strong>${user.fullName}</strong>,</p>
          <p style="color:#555;margin-bottom:24px;">Use the code below to reset your password. It expires in <strong>10 minutes</strong>.</p>
          <div style="background:#f0fafa;border:2px dashed #0d7377;border-radius:10px;padding:20px;text-align:center;">
            <span style="font-size:2.5rem;font-weight:700;letter-spacing:12px;color:#0d7377;">${otp}</span>
          </div>
          <p style="color:#999;font-size:0.85rem;margin-top:24px;">If you didn't request this, please ignore this email.</p>
        </div>
      `
    });

    console.log('✅ Password reset OTP sent to:', user.email);
    res.json({ success: true, message: 'OTP sent to your email.' });

  } catch (err) {
    console.error('❌ Forgot password error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send OTP: ' + err.message });
  }
});

// POST /api/password/verify-otp  — verify OTP only (don't reset yet)
router.post('/verify-otp', async (req, res) => {
  try {
    const User = require('../models/User');
    const { email, otp } = req.body;

    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetPasswordToken: otp,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });

    res.json({ success: true, message: 'OTP verified.' });

  } catch (err) {
    console.error('❌ Verify OTP error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/password/reset  — reset password after OTP verified
router.post('/reset', async (req, res) => {
  try {
    const User = require('../models/User');
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) return res.status(400).json({ success: false, message: 'All fields are required' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetPasswordToken: otp,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });

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
