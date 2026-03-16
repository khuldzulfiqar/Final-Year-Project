// Run this once to test your email setup:
// node test-email.js
require('dotenv').config();
const nodemailer = require('nodemailer');

async function test() {
  console.log('EMAIL_USER:', process.env.EMAIL_USER);
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ loaded (' + process.env.EMAIL_PASS.length + ' chars)' : '❌ MISSING');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    await transporter.verify();
    console.log('✅ Gmail connection successful!');

    await transporter.sendMail({
      from: `"MindBridge Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,   // sends to yourself
      subject: 'MindBridge Email Test ✅',
      html: '<h2>Email is working!</h2><p>Your MindBridge email setup is correct.</p>'
    });
    console.log('✅ Test email sent to', process.env.EMAIL_USER);
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.message.includes('Invalid login')) {
      console.log('\n👉 Fix: Use a Gmail App Password, not your regular Gmail password.');
      console.log('   Go to: myaccount.google.com → Security → App Passwords');
    }
  }
}

test();
