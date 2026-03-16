const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'mindbridge-secret-key-2024',
  resave: false, saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mindbridge:mindbridge12@mindbridge.nas1mkf.mongodb.net/';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err.message));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/psychiatrist', require('./routes/psychiatrist'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/reviews', require('./routes/reviews'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'register.html')));
app.get('/register-psychiatrist', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'register-psychiatrist.html')));
app.get('/psychiatrists', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'psychiatrists.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'dashboard.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'about.html')));
app.get('/create-profile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'create-profile.html')));
app.get('/appointments', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'appointments.html')));
app.get('/reviews', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'reviews.html')));

const PORT = process.env.PORT || 5500;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
