const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  psychiatrist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientName: { type: String, required: true },
  psychiatristName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

reviewSchema.index({ patient: 1, psychiatrist: 1 }, { unique: true });

const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
module.exports = Review;
