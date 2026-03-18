const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const JWT_SECRET = process.env.JWT_SECRET || 'mindbridge-jwt-secret';

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

// Register Patient
router.post('/register-patient', async (req, res) => {
  try {
    const User = require('../models/User');
    const { fullName, cnic, age, email, password } = req.body;
    if (!fullName || !cnic || !email || !password)
      return res.status(400).json({ success: false, message: 'All fields are required' });
    const existing = await User.findOne({ $or: [{ email }, { cnic }] });
    if (existing) return res.status(400).json({ success: false, message: 'Email or CNIC already registered' });
    const user = new User({ fullName, cnic, email, password, role: 'patient', age });
    await user.save();
    res.json({ success: true, message: 'Patient registered successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Register Psychiatrist
router.post('/register-psychiatrist', async (req, res) => {
  try {
    const User = require('../models/User');
    const { fullName, cnic, email, password, phone, specialization, experience, qualification, bio } = req.body;
    if (!fullName || !cnic || !email || !password)
      return res.status(400).json({ success: false, message: 'All required fields must be filled' });
    const existing = await User.findOne({ $or: [{ email }, { cnic }] });
    if (existing) return res.status(400).json({ success: false, message: 'Email or CNIC already registered' });
    const user = new User({ fullName, cnic, email, password, role: 'psychiatrist', phone, specialization, experience, qualification, bio });
    await user.save();
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

// Quick profile update
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    const allowed = ['fullName','phone','specialization','experience','qualification','bio','clinicAddress'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;
