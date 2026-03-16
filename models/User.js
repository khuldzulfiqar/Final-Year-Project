const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  cnic: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['patient', 'psychiatrist'], required: true },
  status: {
  type: String,
  enum: ["Pending", "Approved", "Rejected"],
  default: "Pending"
},
  age: { type: Number },
  phone: { type: String, trim: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  profileImage: { type: String },
  specialization: { type: String, trim: true },
  qualification: { type: String, trim: true },
  experience: { type: String, trim: true },
  licenseNumber: { type: String, trim: true },
  clinicAddress: {
    street:  { type: String, trim: true },
    city:    { type: String, trim: true },
    state:   { type: String, trim: true },
    country: { type: String, trim: true, default: 'Pakistan' },
    lat:     { type: String },
    lng:     { type: String }
  },
  consultationFee: { type: Number },
  consultationModes: {
    online:   { type: Boolean, default: false },
    inPerson: { type: Boolean, default: false }
  },
  availableDays: [{ type: String }],
  timeSlots: [{ start: String, end: String }],
  bio: { type: String, trim: true },
  profileCreated: { type: Boolean, default: false },

  // Password reset fields
  resetPasswordToken:   { type: String },
  resetPasswordExpires: { type: Date },

  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
module.exports = User;
