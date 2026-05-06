const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  psychiatrist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  diagnosis: { type: String, required: true },
  medicines: { type: String, required: true },
  notes: { type: String },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Prescription', prescriptionSchema);