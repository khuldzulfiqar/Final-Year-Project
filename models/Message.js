const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:     { type: String, required: true, trim: true, maxlength: 1000 },
  read:     { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// fast lookups for a conversation and for unread counts
messageSchema.index({ sender: 1, receiver: 1, _id: 1 });
messageSchema.index({ receiver: 1, read: 1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
