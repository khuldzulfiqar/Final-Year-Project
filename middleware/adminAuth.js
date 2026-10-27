// Protects every /api/admin/* route: valid JWT + role 'admin' + admin still exists in DB.
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

module.exports = async function adminAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated' });

    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ success: false, message: 'Invalid or expired token' }); }

    if (decoded.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Admin access only' });

    const admin = await Admin.findById(decoded.id).select('_id');
    if (!admin) return res.status(403).json({ success: false, message: 'Admin not found' });

    req.admin = { id: admin._id };
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
