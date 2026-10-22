const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Admin = require('../models/Admin');

const JWT_SECRET = process.env.JWT_SECRET || 'mindbridge-jwt-secret';
const MAX_LENGTH = 1000;
// A patient and a psychiatrist can chat once an appointment between them is accepted (or completed)
const CHAT_STATUSES = ['accepted', 'completed'];

// Logged-in patient, psychiatrist or admin
async function auth(req, res, next) {
  try {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated' });
    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch { return res.status(401).json({ success: false, message: 'Invalid token' }); }

    if (decoded.role === 'admin') {
      const admin = await Admin.findById(decoded.id).select('fullName');
      if (!admin) return res.status(403).json({ success: false, message: 'Admin not found' });
      req.me = { _id: admin._id, fullName: admin.fullName, role: 'admin' };
      return next();
    }

    const me = await User.findById(decoded.id).select('fullName role');
    if (!me || !['patient', 'psychiatrist'].includes(me.role))
      return res.status(403).json({ success: false, message: 'Chat is only for patients, psychiatrists and the admin' });
    req.me = me;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

const myField = me => (me.role === 'patient' ? 'patient' : 'psychiatrist');
const otherField = me => (me.role === 'patient' ? 'psychiatrist' : 'patient');

// Admin can message any patient/psychiatrist; any patient/psychiatrist can message the admin.
// Patient <-> psychiatrist still needs an accepted/completed appointment.
async function canChat(me, otherId) {
  if (me.role === 'admin') return !!(await User.exists({ _id: otherId }));
  if (await Admin.exists({ _id: otherId })) return true;
  return !!(await Appointment.exists({
    [myField(me)]: me._id,
    [otherField(me)]: otherId,
    status: { $in: CHAT_STATUSES }
  }));
}

const ADMIN_NAME = 'Admin Support';

const displayName = u => (u.role === 'psychiatrist' ? `Dr. ${u.fullName}` : u.fullName);
const subtitleOf = u => (u.role === 'psychiatrist' ? (u.specialization || 'Psychiatrist') : 'Patient');

// The person on the other end of a chat: a User or the Admin
async function findOther(id) {
  const u = await User.findById(id).select('fullName role specialization');
  if (u) return { _id: u._id, name: displayName(u), subtitle: subtitleOf(u), role: u.role };
  const a = await Admin.findById(id).select('fullName');
  if (a) return { _id: a._id, name: ADMIN_NAME, subtitle: 'MindBridge Support', role: 'admin' };
  return null;
}

const between = (a, b) => ({
  $or: [
    { sender: a, receiver: b },
    { sender: b, receiver: a }
  ]
});

const lastTime = c => (c.lastMessage ? new Date(c.lastMessage.createdAt).getTime() : 0);

function sortContacts(list) {
  list.sort((a, b) =>
    lastTime(b) - lastTime(a) ||
    (a.role === 'admin' ? -1 : 0) - (b.role === 'admin' ? -1 : 0) ||
    a.name.localeCompare(b.name));
}

// People I can chat with + last message + unread count
router.get('/contacts', auth, async (req, res) => {
  try {
    const me = req.me;

    // ---- ADMIN: every patient and psychiatrist, with their latest message with admin ----
    if (me.role === 'admin') {
      const users = await User.find({}).select('fullName role specialization');
      const stats = await Message.aggregate([
        { $match: { $or: [{ sender: me._id }, { receiver: me._id }] } },
        { $sort: { _id: -1 } },
        { $group: {
            _id: { $cond: [{ $eq: ['$sender', me._id] }, '$receiver', '$sender'] },
            last: { $first: '$$ROOT' },
            unread: { $sum: { $cond: [{ $and: [{ $eq: ['$receiver', me._id] }, { $eq: ['$read', false] }] }, 1, 0] } }
        } }
      ]);
      const byId = new Map(stats.map(x => [String(x._id), x]));

      const contacts = users.map(u => {
        const st = byId.get(String(u._id));
        return {
          _id: u._id,
          name: displayName(u),
          role: u.role,
          subtitle: subtitleOf(u),
          unread: st ? st.unread : 0,
          lastMessage: st
            ? { text: st.last.text.slice(0, 80), createdAt: st.last.createdAt, mine: st.last.sender.equals(me._id) }
            : null
        };
      });
      sortContacts(contacts);
      return res.json({ success: true, contacts });
    }

    // ---- PATIENT / PSYCHIATRIST: accepted-appointment contacts + the admin ----
    const ids = await Appointment.distinct(otherField(me), {
      [myField(me)]: me._id,
      status: { $in: CHAT_STATUSES }
    });
    const users = await User.find({ _id: { $in: ids } }).select('fullName role specialization');
    const admin = await Admin.findOne().select('fullName');

    const people = users.map(u => ({ _id: u._id, name: displayName(u), role: u.role, subtitle: subtitleOf(u) }));
    if (admin) people.push({ _id: admin._id, name: ADMIN_NAME, role: 'admin', subtitle: 'MindBridge Support' });

    const contacts = await Promise.all(people.map(async p => {
      const last = await Message.findOne(between(me._id, p._id)).sort({ _id: -1 });
      const unread = await Message.countDocuments({ sender: p._id, receiver: me._id, read: false });
      return {
        ...p,
        unread,
        lastMessage: last
          ? { text: last.text.slice(0, 80), createdAt: last.createdAt, mine: last.sender.equals(me._id) }
          : null
      };
    }));

    sortContacts(contacts);
    res.json({ success: true, contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Total unread messages (navbar badge)
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({ receiver: req.me._id, read: false });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Contact Us: id of the admin account, so a user can open the admin conversation
router.get('/admin-contact', auth, async (req, res) => {
  try {
    const admin = await Admin.findOne().select('_id');
    if (!admin) return res.status(404).json({ success: false, message: 'Support is not available right now.' });
    res.json({ success: true, _id: admin._id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Messages with one person. ?after=<messageId> returns only newer messages (used for polling).
router.get('/:userId/messages', auth, async (req, res) => {
  try {
    const me = req.me;
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId))
      return res.status(400).json({ success: false, message: 'Invalid user' });
    if (!(await canChat(me, userId)))
      return res.status(403).json({ success: false, message: 'You can chat with a psychiatrist/patient once an appointment between you is accepted. You can always message the admin.' });

    const other = await findOther(userId);
    if (!other) return res.status(404).json({ success: false, message: 'User not found' });

    const filter = between(me._id, other._id);
    const { after } = req.query;
    let messages;
    if (after && mongoose.isValidObjectId(after)) {
      messages = await Message.find({ $and: [filter, { _id: { $gt: after } }] }).sort({ _id: 1 }).limit(200);
    } else {
      messages = (await Message.find(filter).sort({ _id: -1 }).limit(100)).reverse();
    }

    // anything they sent me is now read
    await Message.updateMany({ sender: other._id, receiver: me._id, read: false }, { read: true });

    res.json({
      success: true,
      other: { _id: other._id, name: other.name, subtitle: other.subtitle, role: other.role },
      messages: messages.map(m => ({
        _id: m._id,
        text: m.text,
        createdAt: m.createdAt,
        mine: m.sender.equals(me._id)
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Send a message
router.post('/:userId/messages', auth, async (req, res) => {
  try {
    const me = req.me;
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId))
      return res.status(400).json({ success: false, message: 'Invalid user' });
    if (!(await canChat(me, userId)))
      return res.status(403).json({ success: false, message: 'You can chat with a psychiatrist/patient once an appointment between you is accepted. You can always message the admin.' });

    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    if (text.length > MAX_LENGTH)
      return res.status(400).json({ success: false, message: `Message is too long (max ${MAX_LENGTH} characters)` });

    const msg = await Message.create({ sender: me._id, receiver: userId, text });
    res.json({
      success: true,
      message: { _id: msg._id, text: msg.text, createdAt: msg.createdAt, mine: true }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
