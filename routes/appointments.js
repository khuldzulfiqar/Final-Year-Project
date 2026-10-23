const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const Prescription = require('../models/Prescription');
const { normalizeMeetingLink } = require('../utils/meeting');

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
// Hourly slots a psychiatrist offers on a given date ("YYYY-MM-DD").
// Returns { dayName, slots } where slots is null if he/she does not sit that day.
function getSlotsForDate(psy, date) {
  const [y, m, d] = date.split('-').map(Number);
  const dayName = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' });

  if (psy.weeklySchedule && psy.weeklySchedule.length > 0) {
    const entry = psy.weeklySchedule.find(e => e.day === dayName);
    return { dayName, slots: entry ? generateHourlySlots(entry.slots) : null };
  }

  // Legacy profiles: same hours on every available day
  if (psy.availableDays && psy.availableDays.length > 0 && !psy.availableDays.includes(dayName))
    return { dayName, slots: null };
  return { dayName, slots: generateHourlySlots(psy.timeSlots) };
}

// Has the appointment slot finished? (date is "YYYY-MM-DD", timeSlot is "HH:MM – HH:MM")
function hasAppointmentPassed(date, timeSlot) {
  const [y, m, d] = date.split('-').map(Number);
  const endPart = (timeSlot || '').split(/[–-]/)[1];
  let endH = 23, endM = 59; // if the slot can't be parsed, fall back to end of that day
  if (endPart) {
    const [h, min] = endPart.trim().split(':').map(Number);
    if (!isNaN(h) && !isNaN(min)) { endH = h; endM = min; }
  }
  return new Date() >= new Date(y, m - 1, d, endH, endM);
}

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// FR_11-03: Get available time slots for a psychiatrist on a date
router.get('/slots/:psychiatristId', async (req, res) => {
  try {
    const psy = await User.findById(req.params.psychiatristId);
    if (!psy) return res.status(404).json({ success: false, message: 'Psychiatrist not found' });

    const { date } = req.query;

    // No date: return the union of all slots (rarely used)
    if (!date) {
      let all = [];
      if (psy.weeklySchedule && psy.weeklySchedule.length > 0)
        psy.weeklySchedule.forEach(e => { all = all.concat(generateHourlySlots(e.slots)); });
      else all = generateHourlySlots(psy.timeSlots);
      return res.json({ success: true, slots: [...new Set(all)], availableDays: psy.availableDays });
    }

    const { dayName, slots: allSlots } = getSlotsForDate(psy, date);
    if (!allSlots)
      return res.json({ success: true, slots: [], message: `Not available on ${dayName}`, availableDays: psy.availableDays });

    // Remove already booked slots for this date
    const booked = await Appointment.find({
      psychiatrist: req.params.psychiatristId,
      date,
      status: { $ne: 'rejected' }
    }).select('timeSlot');
    const bookedSlots = booked.map(b => b.timeSlot);
    const available = allSlots.filter(s => !bookedSlots.includes(s));
    return res.json({ success: true, slots: available, availableDays: psy.availableDays });
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

    // Slot must belong to the psychiatrist's schedule for that weekday
    const { dayName: bookDay, slots: daySlots } = getSlotsForDate(psy, date);
    if (!daySlots)
      return res.status(400).json({ success: false, message: `Dr. ${psy.fullName} is not available on ${bookDay}` });
    if (!daySlots.includes(timeSlot))
      return res.status(400).json({ success: false, message: `That time slot is not available on ${bookDay}. Please choose another.` });

    // Check slot not already booked
    const existing = await Appointment.findOne({
      psychiatrist: psychiatristId,
      date,
      timeSlot,
      status: { $in: ['pending', 'accepted'] }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'This slot is already booked. Please choose another time.'
      });
    }

    // Check patient does not already have an appointment at the same date + time with a DIFFERENT doctor
    const timeConflict = await Appointment.findOne({
      patient: decoded.id,
      date,
      timeSlot,
      psychiatrist: { $ne: psychiatristId },
      status: { $in: ['pending', 'accepted'] }
    });

    if (timeConflict) {
      return res.status(400).json({
        success: false,
        message: `You already have an appointment with Dr. ${timeConflict.psychiatristName} at ${timeSlot} on ${date}. Please choose a different time slot.`
      });
    }
    const [sh, sm] = timeSlot.split('–')[0].trim().split(':').map(Number);
    const [eh, em] = timeSlot.split('–')[1].trim().split(':').map(Number);

    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    if (endMin - startMin < 60) {
      return res.status(400).json({
        success: false,
        message: 'Appointment must be at least 1 hour'
      });
    }

    const appointment = new Appointment({
      patient: decoded.id,
      psychiatrist: psychiatristId,
      patientName: patient.fullName,
      psychiatristName: psy.fullName,
      date, timeSlot, consultationMode,
      notes: notes || ''
    });

    try {
      await appointment.save();

      return res.json({
        success: true,
        message: 'Appointment booked successfully!',
        appointment
      });

    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'This time slot is already booked by another patient'
        });
      }

      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
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

    const { action, rejectionReason, meetingLink } = req.body;
    if (!['accepted', 'rejected'].includes(action))
      return res.status(400).json({ success: false, message: 'Invalid action' });

    // FR_17-06: Require reason for rejection
    if (action === 'rejected' && !rejectionReason)
      return res.status(400).json({ success: false, message: 'Please provide a reason for rejection' });

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    if (appointment.psychiatrist.toString() !== decoded.id)
      return res.status(403).json({ success: false, message: 'Not authorized' });

    // Online appointment: psychiatrist may paste a meeting link while accepting (optional)
    if (action === 'accepted' && appointment.consultationMode === 'online') {
      const m = normalizeMeetingLink(meetingLink);
      if (!m.ok) return res.status(400).json({ success: false, message: m.error });
      if (m.link) {
        appointment.meetingLink = m.link;
        appointment.meetingProvider = m.provider;
        appointment.reminderSent = false;
      }
    }

    appointment.status = action;

    if (action === 'rejected') {
      appointment.rejectionReason = rejectionReason;
    }

    await appointment.save();

    // 👇 PATIENT FETCH
    const patient = await User.findById(appointment.patient);

    // 👇 EMAIL ON ACCEPT
    if (action === 'accepted' && patient) {
      await createTransporter().sendMail({
        from: `"MindBridge" <${process.env.EMAIL_USER}>`,
        to: patient.email,
        subject: 'Appointment Confirmed - MindBridge',
        html: `
      <div style="font-family:Arial;padding:20px">
        <h2 style="color:#0d7377;">Appointment Confirmed ✅</h2>

        <p>Hi <b>${patient.fullName}</b>,</p>

        <p>Your appointment has been <b>ACCEPTED</b>.</p>

        <h3>Details:</h3>
        <ul>
          <li><b>Date:</b> ${appointment.date}</li>
          <li><b>Time:</b> ${appointment.timeSlot}</li>
          <li><b>Mode:</b> ${appointment.consultationMode}</li>
          ${appointment.consultationMode === 'online'
            ? (appointment.meetingLink
                ? `<li><b>Meeting link:</b> <a href="${appointment.meetingLink}">Join online consultation</a></li>`
                : `<li><b>Meeting link:</b> your psychiatrist will share it soon (you will also see it on your dashboard).</li>`)
            : ''}
        </ul>

        <p>Thank you for using MindBridge 💙</p>
      </div>
    `
      });
    }

    // 👇 EMAIL ON REJECT
    if (action === 'rejected' && patient) {
      await createTransporter().sendMail({
        from: `"MindBridge" <${process.env.EMAIL_USER}>`,
        to: patient.email,
        subject: 'Appointment Rejected - MindBridge',
        html: `
      <div style="font-family:Arial;padding:20px">
        <h2 style="color:#dc3545;">Appointment Rejected ❌</h2>

        <p>Hi <b>${patient.fullName}</b>,</p>

        <p>Your appointment has been rejected by the psychiatrist.</p>

        <h3>Reason:</h3>
        <p style="background:#fff0f0;padding:10px;border-radius:8px;">
          ${rejectionReason || 'No reason provided'}
        </p>

        <p>Please book another available slot.</p>
      </div>
    `
      });
    }

    res.json({ success: true, message: `Appointment ${action} successfully!`, appointment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// Psychiatrist adds / replaces the meeting link of an accepted online appointment
router.put('/:id/meeting-link', async (req, res) => {
  try {
    const decoded = getUser(req);
    if (!decoded) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    if (appointment.psychiatrist.toString() !== decoded.id)
      return res.status(403).json({ success: false, message: 'Not authorized' });

    if (appointment.consultationMode !== 'online' || appointment.status !== 'accepted')
      return res.status(400).json({ success: false, message: 'Only accepted online appointments can have a meeting link' });

    const m = normalizeMeetingLink(req.body.meetingLink);
    if (!m.ok) return res.status(400).json({ success: false, message: m.error });
    if (!m.link) return res.status(400).json({ success: false, message: 'Please paste a meeting link' });

    appointment.meetingLink = m.link;
    appointment.meetingProvider = m.provider;
    appointment.reminderSent = false;   // new link -> reminder may go out again if still upcoming
    await appointment.save();

    res.json({ success: true, message: 'Meeting link saved', appointment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/complete', async (req, res) => {
  try {
    const decoded = getUser(req);
    if (!decoded) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment)
      return res.status(404).json({ success: false, message: 'Appointment not found' });

    // only psychiatrist can mark complete
    if (appointment.psychiatrist.toString() !== decoded.id)
      return res.status(403).json({ success: false, message: 'Not authorized' });

    // only accepted appointments can be completed
    if (appointment.status !== 'accepted')
      return res.status(400).json({
        success: false,
        message: appointment.status === 'completed'
          ? 'Appointment is already completed'
          : 'Only accepted appointments can be marked as completed'
      });

    // cannot complete before the appointment time has passed
    if (!hasAppointmentPassed(appointment.date, appointment.timeSlot))
      return res.status(400).json({
        success: false,
        message: `You can mark this appointment as completed only after it ends (${appointment.date}, ${appointment.timeSlot}).`
      });

    appointment.status = 'completed';
    await appointment.save();

    res.json({ success: true, message: 'Appointment marked as completed', appointment });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.post('/:id/prescription', async (req, res) => {
  try {
    const decoded = getUser(req);
    if (!decoded) return res.status(401).json({ message: 'Not authenticated' });

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment)
      return res.status(404).json({ message: 'Appointment not found' });

    if (appointment.status !== 'completed')
      return res.status(400).json({ message: 'Complete appointment first' });

    if (appointment.psychiatrist.toString() !== decoded.id)
      return res.status(403).json({ message: 'Not authorized' });

    const { diagnosis, medicines, notes } = req.body;

    const prescription = new Prescription({
      appointment: appointment._id,
      patient: appointment.patient,
      psychiatrist: appointment.psychiatrist,
      diagnosis,
      medicines,
      notes
    });

    await prescription.save();

    res.json({ success: true, message: 'Prescription created', prescription });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/prescriptions/patient', async (req, res) => {
  try {
    const decoded = getUser(req);
    if (!decoded) return res.status(401).json({ message: 'Not authenticated' });

    const prescriptions = await Prescription.find({ patient: decoded.id })
      .populate('psychiatrist', 'fullName')
      .sort({ createdAt: -1 });

    res.json({ success: true, prescriptions });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;
