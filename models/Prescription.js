const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  psychiatrist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  diagnosis: { type: String, required: true },
  medicines: { type: String, required: true },   // legacy / summary text (kept so old prescriptions still work)
  medicineList: [{
    _id: false,
    name: { type: String, trim: true },
    dosage: { type: String, trim: true },
    timing: { type: String, trim: true },
    schedule: {
      morning: { type: String, trim: true, default: '' },
      afternoon: { type: String, trim: true, default: '' },
      night: { type: String, trim: true, default: '' }
    },
    duration: { type: String, trim: true }
  }],
  tests: [{ type: String, trim: true }],           // lab tests / investigations referred by psychiatrist
  notes: { type: String },
  hiddenByPatient: { type: Boolean, default: false },  // patient removed it from their own list (doctor's record is kept)

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Prescription', prescriptionSchema);