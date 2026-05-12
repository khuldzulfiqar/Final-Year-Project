const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Admin = require('../models/Admin');

const JWT_SECRET = process.env.JWT_SECRET || 'mindbridge-jwt-secret';

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// Send OTP to email
router.post('/send-otp', async (req, res) => {
  try {
    const User = require('../models/User');
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    // Check email not already registered
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ success: false, message: 'This email is already registered' });

    const otp = generateOTP();
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP temporarily using a lightweight in-memory map (keyed by email)
    otpStore.set(email.toLowerCase().trim(), { hashedOTP, expires });

    await createTransporter().sendMail({
      from: `"MindBridge" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your MindBridge Verification Code',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="color:#0d7377;margin-bottom:8px;">Email Verification</h2>
          <p style="color:#555;margin-bottom:24px;">Use the code below to verify your email address. It expires in <strong>10 minutes</strong>.</p>
          <div style="background:#f0fafa;border:2px dashed #0d7377;border-radius:10px;padding:20px;text-align:center;">
            <span style="font-size:2.2rem;font-weight:700;letter-spacing:10px;color:#0d7377;">${otp}</span>
          </div>
          <p style="color:#999;font-size:0.8rem;margin-top:24px;">If you didn't request this, please ignore this email.</p>
        </div>
      `
    });

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send OTP: ' + err.message });
  }
});

// In-memory OTP store (email -> { hashedOTP, expires })
const otpStore = new Map();

// Verify OTP
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

  const key = email.toLowerCase().trim();
  const record = otpStore.get(key);

  if (!record) return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
  if (Date.now() > record.expires) {
    otpStore.delete(key);
    return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
  }

  const hashedInput = crypto.createHash('sha256').update(otp.trim()).digest('hex');
  if (hashedInput !== record.hashedOTP)
    return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });

  // Mark as verified (keep for 15 min so registration can proceed)
  otpStore.set(key, { ...record, verified: true, verifiedAt: Date.now() });
  res.json({ success: true, message: 'Email verified successfully' });
});

// Register Patient
router.post('/register-patient', async (req, res) => {
  try {
    const User = require('../models/User');
    const { fullName, cnic, age, email, password } = req.body;
    if (!fullName || !cnic || !age || !email || !password)
      return res.status(400).json({ success: false, message: 'All fields are required' });

    // CNIC validation: must match XXXXX-XXXXXXX-X
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (!cnicRegex.test(cnic))
      return res.status(400).json({ success: false, message: 'Invalid CNIC format. Use XXXXX-XXXXXXX-X' });

    // Age validation: patients must be between 18 and 100
    const ageNum = Number(age);
    if (!Number.isInteger(ageNum) || ageNum < 18 || ageNum > 100)
      return res.status(400).json({ success: false, message: 'Age must be between 18 and 100' });

    // Password strength validation
    if (password.length < 8 || !/[!@#$%^&*()\-_=+\[\]{};:'",.<>/?`~\\|]/.test(password))
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters and contain at least one special character.' });

    // Check OTP verified
    const otpRecord = otpStore.get(email.toLowerCase().trim());
    if (!otpRecord || !otpRecord.verified)
      return res.status(400).json({ success: false, message: 'Please verify your email with OTP before registering' });

    const existing = await User.findOne({ $or: [{ email }, { cnic }] });
    if (existing) return res.status(400).json({ success: false, message: 'Email or CNIC already registered' });
    const user = new User({ fullName, cnic, email, password, role: 'patient', age, isEmailVerified: true });
    await user.save();
    otpStore.delete(email.toLowerCase().trim());
    res.json({ success: true, message: 'Patient registered successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Register Psychiatrist
router.post('/register-psychiatrist', async (req, res) => {
  try {
    const User = require('../models/User');
    const { fullName, cnic, age, email, password, phone, specialization, experience, qualification, bio, licenseNumber } = req.body;
    if (!fullName || !cnic || !email || !password)
      return res.status(400).json({ success: false, message: 'All required fields must be filled' });
    if (!licenseNumber)
      return res.status(400).json({ success: false, message: 'License number is required' });

    // CNIC validation: must match XXXXX-XXXXXXX-X
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
    if (!cnicRegex.test(cnic))
      return res.status(400).json({ success: false, message: 'Invalid CNIC format. Use XXXXX-XXXXXXX-X' });

    // Age validation: psychiatrists must be between 25 and 80
    if (age !== undefined && age !== '') {
      const ageNum = Number(age);
      if (!Number.isInteger(ageNum) || ageNum < 25 || ageNum > 80)
        return res.status(400).json({ success: false, message: 'Age must be between 25 and 80' });
    }

    // Password strength validation
    if (password.length < 8 || !/[!@#$%^&*()\-_=+\[\]{};:'",.<>/?`~\\|]/.test(password))
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters and contain at least one special character.' });

    // Check OTP verified
    const otpRecord = otpStore.get(email.toLowerCase().trim());
    if (!otpRecord || !otpRecord.verified)
      return res.status(400).json({ success: false, message: 'Please verify your email with OTP before registering' });

    const existing = await User.findOne({ $or: [{ email }, { cnic }] });
    if (existing) return res.status(400).json({ success: false, message: 'Email or CNIC already registered' });
    const user = new User({ fullName, cnic, email, password, role: 'psychiatrist', phone, specialization, experience, qualification, bio, licenseNumber, isEmailVerified: true });
    await user.save();
    otpStore.delete(email.toLowerCase().trim());
    res.json({ success: true, message: 'Psychiatrist registered successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// Login
router.post('/login', async (req, res) => {
  try {
    const User = require('../models/User');
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    // 🔥 1. Check Admin FIRST
    const admin = await Admin.findOne({ email });

    if (admin) {
      const match = await admin.comparePassword(password);

      if (!match)
        return res.status(400).json({ success: false, message: 'Invalid email or password' });

      const token = generateToken({ _id: admin._id, role: 'admin' });

      return res.json({
        success: true,
        token,
        user: {
          _id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
          role: 'admin'
        }
      });
    }

    // 🔥 2. Check User (Patient / Psychiatrist)
    const user = await User.findOne({ email });

    if (!user)
      return res.status(400).json({ success: false, message: 'Invalid email or password' });

    const match = await user.comparePassword(password);

    if (!match)
      return res.status(400).json({ success: false, message: 'Invalid email or password' });

    // psychiatrist approval check
    if (user.role === 'psychiatrist' && user.status !== 'Approved') {
      return res.status(403).json({
        success: false,
        message: 'Your account is not approved yet'
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create / update full psychiatrist profile (FR_14)
router.post('/create-profile', authMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    const {
      fullName, phone, gender, profileImage, bio,
      specialization, experience, qualification, licenseNumber,
      consultationFee, consultationModes,
      availableDays, timeSlots,
      clinicAddress
    } = req.body;
    const fee = Number(consultationFee);

    if (consultationFee !== undefined) {
      if (isNaN(fee) || fee <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Consultation fee must be a positive number'
      });
    }
    }
    // Validate time slots
    if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one time slot is required'
      });
  }

  for (const slot of timeSlots) {
    const [sh, sm] = slot.start.split(':').map(Number);
    const [eh, em] = slot.end.split(':').map(Number);

    const startMin = sh * 60 + sm;
    const endMin   = eh * 60 + em;

    const duration = endMin - startMin;

  // ❌ End must be after start
    if (duration <= 0) {
      return res.status(400).json({
       success: false,
       message: 'End time must be after start time'
      });
    }

  // ❌ Minimum 2 hours
   if (duration < 120) {
      return res.status(400).json({
        success: false,
        message: 'Each slot must be at least 2 hours'
      });
    }
  }

    const updateData = {
      fullName, phone, gender, bio,
      specialization, experience, qualification, licenseNumber,
      consultationFee, consultationModes,
      availableDays, timeSlots,
      clinicAddress,
      profileCreated: true
    };
    if (profileImage) updateData.profileImage = profileImage;

    const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true }).select('-password');
    res.json({ success: true, message: 'Profile created successfully!', user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Quick profile update (patients + psychiatrists)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    const allowed = [
      'fullName', 'phone', 'age', 'gender',
      'specialization', 'experience', 'qualification', 'bio', 'clinicAddress'
    ];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;
