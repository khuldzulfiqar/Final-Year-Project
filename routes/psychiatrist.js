const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Get all psychiatrists
router.get('/', async (req, res) => {
  try {
    const psychiatrists = await User.find({ role: 'psychiatrist' }).select('-password');
    res.json({ success: true, psychiatrists });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single psychiatrist
router.get('/:id', async (req, res) => {
  try {
    const psychiatrist = await User.findById(req.params.id).select('-password');
    if (!psychiatrist || psychiatrist.role !== 'psychiatrist')
      return res.status(404).json({ success: false, message: 'Psychiatrist not found' });
    res.json({ success: true, psychiatrist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
