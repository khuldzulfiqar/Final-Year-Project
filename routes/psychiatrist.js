const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Get all psychiatrists — optionally filtered by ?specialization=Anxiety
// (used by the screening results page to suggest a matching doctor).
router.get('/', async (req, res) => {
  try {
    const filter = { role: 'psychiatrist' };
    if (req.query.specialization) {
      // escape regex special characters so the search text can't break the query
      const term = String(req.query.specialization).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.specialization = { $regex: term, $options: 'i' };
    }
    // No limit: return ALL psychiatrists matching the filter.
    const psychiatrists = await User.find(filter).select('-password');
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
