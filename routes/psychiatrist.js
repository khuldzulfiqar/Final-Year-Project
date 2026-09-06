const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Get all psychiatrists — optionally filtered by ?specialization=Anxiety
// (used by the screening results page to suggest a matching doctor).
router.get('/', async (req, res) => {
  try {
    const filter = { role: 'psychiatrist' };
    if (req.query.specialization) {
      filter.specialization = { $regex: req.query.specialization, $options: 'i' };
    }
    let query = User.find(filter).select('-password');
    if (req.query.specialization) query = query.limit(3);
    const psychiatrists = await query;
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
