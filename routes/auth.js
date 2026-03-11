const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'mindbridge-jwt-secret';
const User = require('../models/User');

console.log('User model:', User);
console.log('User.findOne:', User.findOne);

// Register Patient
router.post('/register-patient', async (req, res) => {
  try {
    console.log('Body received:', req.body);
    const { fullName, cnic, age, email, password } = req.body;

    if (!fullName || !cnic || !age || !email || !password)
      return res.status(400).json({ success: false, message: 'All fields are required' });

    const existingEmail = await User.findOne({ email: email });
    if (existingEmail)
      return res.status(400).json({ success: false, message: 'Email already registered' });

    const existingCnic = await User.findOne({ cnic: cnic });
    if (existingCnic)
      return res.status(400).json({ success: false, message: 'CNIC already registered' });

    const user = new User({ fullName, cnic, age: parseInt(age), email, password, role: 'patient' });
    await user.save();
    res.json({ success: true, message: 'Patient registered successfully!' });

  } catch (err) {
    console.error('Register patient error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Register Psychiatrist
router.post('/register-psychiatrist', async (req, res) => {
  try {
    console.log('Body received:', req.body);
    const { fullName, cnic, email, password } = req.body;

    if (!fullName || !cnic || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, CNIC, Email and Password are required' });

    const existingEmail = await User.findOne({ email: email });
    if (existingEmail)
      return res.status(400).json({ success: false, message: 'Email already registered' });

    const existingCnic = await User.findOne({ cnic: cnic });
    if (existingCnic)
      return res.status(400).json({ success: false, message: 'CNIC already registered' });

    const user = new User({ fullName, cnic, email, password, role: 'psychiatrist' });
    await user.save();
    res.json({ success: true, message: 'Psychiatrist registered successfully!' });

  } catch (err) {
    console.error('Register psychiatrist error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    const user = await User.findOne({ email: email });
    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.fullName },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true, token,
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role, profileCreated: user.profileCreated }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, user });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// FR_14: Create / Update Psychiatrist Profile
router.post('/create-profile', async (req, res) => {
  try {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const {
      fullName, phone, gender, profileImage,
      specialization, qualification, experience, licenseNumber,
      consultationFee, consultationModes,
      availableDays, timeSlots, bio
    } = req.body;

    // FR_14-09: Validate required fields
    if (!fullName || !phone || !gender || !specialization || !qualification || !experience || !licenseNumber) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }
    if (!consultationModes || (!consultationModes.online && !consultationModes.inPerson)) {
      return res.status(400).json({ success: false, message: 'Please select at least one consultation mode' });
    }
    if (!availableDays || availableDays.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one available day' });
    }
    if (!timeSlots || timeSlots.length === 0) {
      return res.status(400).json({ success: false, message: 'Please add at least one time slot' });
    }

    // FR_14-12: Save to database
    const user = await User.findByIdAndUpdate(
      decoded.id,
      {
        fullName, phone, gender, profileImage,
        specialization, qualification, experience, licenseNumber,
        consultationFee: parseFloat(consultationFee) || 0,
        consultationModes,
        availableDays,
        timeSlots,
        bio,
        profileCreated: true
      },
      { new: true }
    ).select('-password');

    // FR_14-13: Success message
    res.json({ success: true, message: 'Profile created successfully!', user });

  } catch (err) {
    console.error('Create profile error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update profile (general)
router.put('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const {
      fullName, phone, gender, profileImage,
      specialization, qualification, experience, licenseNumber,
      consultationFee, consultationModes,
      availableDays, timeSlots, bio
    } = req.body;

    const user = await User.findByIdAndUpdate(
      decoded.id,
      {
        fullName, phone, gender, profileImage,
        specialization, qualification, experience, licenseNumber,
        consultationFee: parseFloat(consultationFee) || 0,
        consultationModes, availableDays, timeSlots, bio,
        profileCreated: true
      },
      { new: true }
    ).select('-password');

    res.json({ success: true, user, message: 'Profile updated successfully!' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
