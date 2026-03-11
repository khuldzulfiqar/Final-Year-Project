const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Auth Fields
  fullName: { type: String, required: true, trim: true },
  cnic: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['patient', 'psychiatrist'], required: true },
  age: { type: Number },

  // FR_14-04: Personal Details
  phone: { type: String, default: '' },
  gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },
  profileImage: { type: String, default: '' },

  // FR_14-05: Professional Details
  specialization: { type: String, default: '' },
  qualification: { type: String, default: '' },
  experience: { type: String, default: '' },
  licenseNumber: { type: String, default: '' },

  // FR_14-07: Consultation Details
  consultationFee: { type: Number, default: 0 },
  consultationModes: {
    online: { type: Boolean, default: false },
    inPerson: { type: Boolean, default: false }
  },

  // FR_14-08: Availability
  availableDays: [{ type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] }],
  timeSlots: [{ start: { type: String }, end: { type: String } }],

  bio: { type: String, default: '' },
  profileCreated: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
