const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mindbridge-jwt-secret';

function getUser(req) {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

// FR_12: Submit review
router.post('/submit', async (req, res) => {
  try {
    const Review = require('../models/Review');
    const User = require('../models/User');

    const decoded = getUser(req);
    if (!decoded) return res.status(401).json({ success: false, message: 'Please login first' });

    const patient = await User.findOne({ _id: decoded.id });
    if (!patient || patient.role !== 'patient')
      return res.status(403).json({ success: false, message: 'Only patients can submit reviews' });

    const { psychiatristId, rating, comment } = req.body;
    if (!psychiatristId || !rating || !comment)
      return res.status(400).json({ success: false, message: 'Rating and comment are required' });
    if (rating < 1 || rating > 5)
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });

    const psy = await User.findOne({ _id: psychiatristId });
    if (!psy) return res.status(404).json({ success: false, message: 'Psychiatrist not found' });

    // Check if already reviewed
    const existing = await Review.findOne({ patient: decoded.id, psychiatrist: psychiatristId });
    if (existing) {
      existing.rating = parseInt(rating);
      existing.comment = comment;
      existing.createdAt = new Date();
      await existing.save();
      return res.json({ success: true, message: 'Review updated successfully!', review: existing });
    }

    const review = new Review({
      patient: decoded.id,
      psychiatrist: psychiatristId,
      patientName: patient.fullName,
      psychiatristName: psy.fullName,
      rating: parseInt(rating),
      comment
    });
    await review.save();
    res.json({ success: true, message: 'Review submitted successfully!', review });

  } catch (err) {
    console.error('Submit review error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get reviews for a psychiatrist (public)
router.get('/psychiatrist/:psychiatristId', async (req, res) => {
  try {
    const Review = require('../models/Review');
    const { sort, minRating, maxRating } = req.query;
    const filter = { psychiatrist: req.params.psychiatristId };
    if (minRating || maxRating) {
      filter.rating = {};
      if (minRating) filter.rating.$gte = parseInt(minRating);
      if (maxRating) filter.rating.$lte = parseInt(maxRating);
    }
    let sortObj = { createdAt: -1 };
    if (sort === 'rating_desc') sortObj = { rating: -1 };
    if (sort === 'rating_asc') sortObj = { rating: 1 };
    if (sort === 'date_asc') sortObj = { createdAt: 1 };

    const reviews = await Review.find(filter).sort(sortObj);
    const allReviews = await Review.find({ psychiatrist: req.params.psychiatristId });
    const avgRating = allReviews.length > 0
      ? (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1) : 0;

    res.json({ success: true, reviews, avgRating: parseFloat(avgRating), totalReviews: allReviews.length });
  } catch (err) {
    console.error('Get reviews error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all reviews for logged-in psychiatrist
router.get('/my-reviews', async (req, res) => {
  try {
    const Review = require('../models/Review');
    const decoded = getUser(req);
    if (!decoded) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const { sort, minRating, maxRating } = req.query;
    const filter = { psychiatrist: decoded.id };
    if (minRating || maxRating) {
      filter.rating = {};
      if (minRating) filter.rating.$gte = parseInt(minRating);
      if (maxRating) filter.rating.$lte = parseInt(maxRating);
    }
    let sortObj = { createdAt: -1 };
    if (sort === 'rating_desc') sortObj = { rating: -1 };
    if (sort === 'rating_asc') sortObj = { rating: 1 };
    if (sort === 'date_asc') sortObj = { createdAt: 1 };

    const reviews = await Review.find(filter).sort(sortObj);
    const allReviews = await Review.find({ psychiatrist: decoded.id });
    const avgRating = allReviews.length > 0
      ? (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1) : 0;

    const distribution = { 5:0, 4:0, 3:0, 2:0, 1:0 };
    allReviews.forEach(r => distribution[r.rating]++);

    res.json({ success: true, reviews, avgRating: parseFloat(avgRating), totalReviews: allReviews.length, distribution });
  } catch (err) {
    console.error('My reviews error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
