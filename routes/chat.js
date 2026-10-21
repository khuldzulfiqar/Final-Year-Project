const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'mindbridge-jwt-secret';
const MAX_LENGTH = 1000;
// A patient and a psychiatrist can chat once an appointment between them is accepted (or completed)
const CHAT_STATUSES = ['accepted', 'completed'];

// Logged-in patient or psychiatrist only
async function auth(req, res, next) {
  try {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated' });
    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch { return res.status(401).json({ success: false, message: 'Invalid token' }); }

    const me = await User.findById(decoded.id).select('fullName role');
    if (!me || !['patient', 'psychiatrist'].includes(me.role))
      return res.status(403).json({ success: false, message: 'Chat is only for patients and psychiatrists' });
    req.me = me;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

const myField = me => (me.role === 'patient' ? 'patient' : 'psychiatrist');
const otherField = me => (me.role === 'patient' ? 'psychiatrist' : 'patient');

async function canChat(me, otherId) {
  return !!(await Appointment.exists({
    [myField(me)]: me._id,
    [otherField(me)]: otherId,
    status: { $in: CHAT_STATUSES }
  }));
}

const displayName = u => (u.role === 'psychiatrist' ? `Dr. ${u.fullName}` : u.fullName);

const between = (a, b) => ({
  $or: [
    { sender: a, receiver: b },
    { sender: b, receiver: a }
  ]
});

// People I can chat with + last message + unread count
router.get('/contacts', auth, async (req, res) => {
  try {
    const me = req.me;
    const ids = await Appointment.distinct(otherField(me), {
      [myField(me)]: me._id,
      status: { $in: CHAT_STATUSES }
    });
    const users = await User.find({ _id: { $in: ids } }).select('fullName role specialization');

    const contacts = await Promise.all(users.map(async u => {
      const last = await Message.findOne(between(me._id, u._id)).sort({ _id: -1 });
      const unread = await Message.countDocuments({ sender: u._id, receiver: me._id, read: false });
      return {
        _id: u._id,
        name: displayName(u),
        subtitle: u.role === 'psychiatrist' ? (u.specialization || 'Psychiatrist') : 'Patient',
        unread,
        lastMessage: last
          ? { text: last.text.slice(0, 80), createdAt: last.createdAt, mine: last.sender.equals(me._id) }
          : null
      };
    }));

    contacts.sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return tb - ta || a.name.localeCompare(b.name);
    });

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

// Messages with one person. ?after=<messageId> returns only newer messages (used for polling).
router.get('/:userId/messages', auth, async (req, res) => {
  try {
    const me = req.me;
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId))
      return res.status(400).json({ success: false, message: 'Invalid user' });
    if (!(await canChat(me, userId)))
      return res.status(403).json({ success: false, message: 'You can chat once an appointment between you is accepted.' });

    const other = await User.findById(userId).select('fullName role specialization');
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
      other: {
        _id: other._id,
        name: displayName(other),
        subtitle: other.role === 'psychiatrist' ? (other.specialization || 'Psychiatrist') : 'Patient'
      },
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
      return res.status(403).json({ success: false, message: 'You can chat once an appointment between you is accepted.' });

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
