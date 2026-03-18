const mongoose = require('mongoose');
const Admin = require('./models/Admin');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mindbridge:mindbridge12@mindbridge.nas1mkf.mongodb.net/';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err.message));

async function createAdmin() {
  const admin = new Admin({
    fullName: 'Admin',
    email: 'admin@gmail.com',
    password: '123456'
  });

  await admin.save();
  console.log('Admin created');
  mongoose.disconnect();
}

createAdmin();