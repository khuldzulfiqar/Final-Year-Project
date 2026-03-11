const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  psychiatrist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientName: { type: String, required: true },
  psychiatristName: { type: String, required: true },
  date: { type: String, required: true },
  timeSlot: { type: String, required: true },
  consultationMode: { type: String, enum: ['online', 'inPerson'], required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  rejectionReason: { type: String, default: '' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const Appointment = mongoose.model('Appointment', appointmentSchema);
module.exports = Appointment;
