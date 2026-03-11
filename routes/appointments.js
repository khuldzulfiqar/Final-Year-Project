const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'mindbridge-jwt-secret';

function getUser(req) {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

// Generate 1-hour slots from psychiatrist timeSlots
function generateHourlySlots(timeSlots) {
  const slots = [];
  if (!timeSlots || timeSlots.length === 0) return slots;
  timeSlots.forEach(ts => {
    let [startH, startM] = ts.start.split(':').map(Number);
    let [endH, endM] = ts.end.split(':').map(Number);
    let current = startH * 60 + startM;
    const end = endH * 60 + endM;
    while (current + 60 <= end) {
      const hStart = String(Math.floor(current / 60)).padStart(2, '0');
      const mStart = String(current % 60).padStart(2, '0');
      const hEnd = String(Math.floor((current + 60) / 60)).padStart(2, '0');
      const mEnd = String((current + 60) % 60).padStart(2, '0');
      slots.push(`${hStart}:${mStart} – ${hEnd}:${mEnd}`);
      current += 60;
    }
  });
  return slots;
}

// FR_11-03: Get available time slots for a psychiatrist on a date
router.get('/slots/:psychiatristId', async (req, res) => {
  try {
    const psy = await User.findById(req.params.psychiatristId);
    if (!psy) return res.status(404).json({ success: false, message: 'Psychiatrist not found' });

    const { date } = req.query;
    const dayName = date ? new Date(date).toLocaleDateString('en-US', { weekday: 'long' }) : null;

    // Check if psychiatrist works on this day
    if (dayName && psy.availableDays && !psy.availableDays.includes(dayName)) {
      return res.json({ success: true, slots: [], message: `Not available on ${dayName}` });
    }

    const allSlots = generateHourlySlots(psy.timeSlots);

    // Remove already booked slots for this date
    if (date) {
      const booked = await Appointment.find({
        psychiatrist: req.params.psychiatristId,
        date,
        status: { $ne: 'rejected' }
      }).select('timeSlot');
      const bookedSlots = booked.map(b => b.timeSlot);
      const available = allSlots.filter(s => !bookedSlots.includes(s));
      return res.json({ success: true, slots: available, availableDays: psy.availableDays });
    }

    res.json({ success: true, slots: allSlots, availableDays: psy.availableDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// FR_11: Book appointment
router.post('/book', async (req, res) => {
  try {
    const decoded = getUser(req);
    if (!decoded) return res.status(401).json({ success: false, message: 'Please login first' });

    const patient = await User.findById(decoded.id);
    if (!patient || patient.role !== 'patient')
      return res.status(403).json({ success: false, message: 'Only patients can book appointments' });

    const { psychiatristId, date, timeSlot, consultationMode, notes } = req.body;
    if (!psychiatristId || !date || !timeSlot || !consultationMode)
      return res.status(400).json({ success: false, message: 'All fields are required' });

    const psy = await User.findById(psychiatristId);
    if (!psy) return res.status(404).json({ success: false, message: 'Psychiatrist not found' });

    // Check slot not already booked
    const existing = await Appointment.findOne({
      psychiatrist: psychiatristId, date, timeSlot, status: { $ne: 'rejected' }
    });
    if (existing) return res.status(400).json({ success: false, message: 'This slot is already booked. Please choose another.' });

    const appointment = new Appointment({
      patient: decoded.id,
      psychiatrist: psychiatristId,
      patientName: patient.fullName,
      psychiatristName: psy.fullName,
      date, timeSlot, consultationMode,
      notes: notes || ''
    });

    await appointment.save();
    res.json({ success: true, message: 'Appointment request submitted successfully!', appointment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// FR_16: Get appointments for psychiatrist
router.get('/psychiatrist', async (req, res) => {
  try {
    const decoded = getUser(req);
    if (!decoded) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const { status, date } = req.query;
    const filter = { psychiatrist: decoded.id };
    if (status) filter.status = status;
    if (date) filter.date = date;

    const appointments = await Appointment.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// FR_11-07: Get appointments for patient
router.get('/patient', async (req, res) => {
  try {
    const decoded = getUser(req);
    if (!decoded) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const appointments = await Appointment.find({ patient: decoded.id }).sort({ createdAt: -1 });
    res.json({ success: true, appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// FR_17-04 & FR_17-05: Accept or Reject
router.put('/:id/action', async (req, res) => {
  try {
    const decoded = getUser(req);
    if (!decoded) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const { action, rejectionReason } = req.body;
    if (!['accepted', 'rejected'].includes(action))
      return res.status(400).json({ success: false, message: 'Invalid action' });

    // FR_17-06: Require reason for rejection
    if (action === 'rejected' && !rejectionReason)
      return res.status(400).json({ success: false, message: 'Please provide a reason for rejection' });

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    if (appointment.psychiatrist.toString() !== decoded.id)
      return res.status(403).json({ success: false, message: 'Not authorized' });

    appointment.status = action;
    if (action === 'rejected') appointment.rejectionReason = rejectionReason;
    await appointment.save();

    res.json({ success: true, message: `Appointment ${action} successfully!`, appointment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
