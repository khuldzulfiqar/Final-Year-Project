const mongoose = require('mongoose');

// A file or image shared inside a conversation (stored on Cloudinary)
const attachmentSchema = new mongoose.Schema({
  url:      { type: String, required: true },
  publicId: { type: String },
  name:     { type: String, trim: true, maxlength: 200 },
  mimeType: { type: String },
  size:     { type: Number },
  kind:     { type: String, enum: ['image', 'file'], required: true }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  // sender/receiver can be a User (patient/psychiatrist) or the Admin, so no single 'ref'
  sender:   { type: mongoose.Schema.Types.ObjectId, required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, required: true },
  // text is optional when a file/image is attached
  text:     { type: String, trim: true, maxlength: 1000, default: '' },
  attachment: { type: attachmentSchema, default: undefined },
  read:     { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// a message needs text, an attachment, or both
// (Mongoose 9 hooks take no next() callback)
messageSchema.pre('validate', function () {
  if (!this.text && !this.attachment) this.invalidate('text', 'Message cannot be empty');
});

// fast lookups for a conversation and for unread counts
messageSchema.index({ sender: 1, receiver: 1, _id: 1 });
messageSchema.index({ receiver: 1, read: 1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
