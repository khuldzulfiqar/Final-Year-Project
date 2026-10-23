// Sends an email to BOTH patient and psychiatrist 10 minutes before an online consultation.
// Runs inside the server process (no extra packages). Each appointment is reminded only once.

const nodemailer = require('nodemailer');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

const TZ_OFFSET = process.env.APP_TZ_OFFSET || '+05:00';   // Pakistan (no DST)
const REMIND_BEFORE_MIN = 10;

// "2026-10-25" + "14:00 – 15:00"  ->  Date of 14:00 in Pakistan time (independent of server time zone)
function slotStart(date, timeSlot) {
  const start = (timeSlot || '').split(/[–-]/)[0].trim().padStart(5, '0');
  const d = new Date(`${date}T${start}:00${TZ_OFFSET}`);
  return isNaN(d) ? null : d;
}

function sendReminderMail(to, name, otherName, a) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  }).sendMail({
    from: `"MindBridge" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Reminder: Your online consultation starts in 10 minutes',
    html: `
      <div style="font-family:Arial;padding:20px">
        <h2 style="color:#0d7377;">⏰ Meeting in 10 minutes</h2>
        <p>Hi <b>${name}</b>,</p>
        <p>Your online consultation with <b>${otherName}</b> starts at <b>${a.timeSlot}</b> on ${a.date}.</p>
        <p><a href="${a.meetingLink}" style="background:#0d7377;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">🎥 Join Meeting</a></p>
        <p style="color:#888;font-size:12px;">MindBridge</p>
      </div>`
  });
}

let running = false;

async function sendDueReminders() {
  if (running) return;                       // never overlap two runs
  running = true;
  try {
    const now = new Date();
    const dayStr = n => new Date(now.getTime() + n * 86400000).toISOString().slice(0, 10);

    const candidates = await Appointment.find({
      status: 'accepted',
      consultationMode: 'online',
      reminderSent: { $ne: true },
      meetingLink: { $nin: ['', null] },
      date: { $in: [dayStr(-1), dayStr(0), dayStr(1)] }
    });

    for (const a of candidates) {
      const start = slotStart(a.date, a.timeSlot);
      if (!start || now >= start || start > new Date(now.getTime() + REMIND_BEFORE_MIN * 60000)) continue;

      // Atomic claim: only one run can win, so nobody gets a duplicate reminder
      const claimed = await Appointment.findOneAndUpdate(
        { _id: a._id, reminderSent: { $ne: true } },
        { reminderSent: true }
      );
      if (!claimed) continue;

      const [patient, psy] = await Promise.all([User.findById(a.patient), User.findById(a.psychiatrist)]);
      const jobs = [];
      if (patient) jobs.push(sendReminderMail(patient.email, patient.fullName, `Dr. ${a.psychiatristName}`, a));
      if (psy)     jobs.push(sendReminderMail(psy.email, `Dr. ${psy.fullName}`, a.patientName, a));

      const results = await Promise.allSettled(jobs);
      // If every email failed, release the claim so the next minute retries (until the meeting starts)
      if (results.length && results.every(r => r.status === 'rejected')) {
        await Appointment.updateOne({ _id: a._id }, { reminderSent: false });
        console.error('Reminder email failed:', results[0].reason && results[0].reason.message);
      }
    }
  } catch (err) {
    console.error('Reminder job error:', err.message);
  } finally {
    running = false;
  }
}

function start() {
  setInterval(sendDueReminders, 60 * 1000);
  console.log('⏰ Meeting reminder scheduler started');
}

module.exports = { start, sendDueReminders, slotStart };
